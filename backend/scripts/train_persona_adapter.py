"""
Afterlight — Persona Adapter Training Script (QLoRA)
Target: NVIDIA RTX 5050 Laptop GPU (Blackwell sm_120, 8GB VRAM)
Model: google/gemma-4-e2b-it (2B params, 4-bit NF4 quantization)

VRAM Budget (8GB):
  - Base model in NF4:     ~1.5 GB
  - LoRA adapters (r=16):  ~200 MB
  - Optimizer states:      ~800 MB
  - Activations (len=512): ~1.5 GB
  - Total estimated:       ~4-5 GB  ← safe headroom on 8GB

This script is launched by the API endpoint train-adapter and can also be
run standalone from the command line.

CLI usage:
  python scripts/train_persona_adapter.py \\
    --space_id <uuid> \\
    --dataset_path storage/training/<uuid>/training_data.jsonl \\
    --output_dir storage/adapters/<uuid> \\
    --job_id <uuid>
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("afterlight.training")

# ─── Strict Model Validation ──────────────────────────────────────────────────
ALLOWED_MODELS = {
    "google/gemma-4-e2b-it",
    "google/gemma-4-e4b-it",
}

def validate_gemma4_model(model_id: str) -> None:
    """Refuse to train on anything that is not Gemma 4. No exceptions."""
    model_lower = model_id.strip().rstrip("/")
    if not any(model_lower == allowed or model_lower.endswith(allowed.split("/")[-1])
               for allowed in ALLOWED_MODELS):
        logger.error(
            f"REJECTED: '{model_id}' is not a Gemma 4 model.\n"
            f"Afterlight training is restricted to: {ALLOWED_MODELS}\n"
            f"This hackathon submission requires Gemma 4. No other model will be accepted."
        )
        sys.exit(1)
    logger.info(f"Model validated: {model_id} ✓")


# ─── GPU Check ────────────────────────────────────────────────────────────────
def check_gpu() -> tuple[bool, str]:
    """Return (has_cuda, device_name)."""
    try:
        import torch
        if not torch.cuda.is_available():
            return False, "CPU"
        name = torch.cuda.get_device_name(0)
        vram = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        logger.info(f"GPU: {name} | VRAM: {vram:.1f} GB")
        if vram < 6.0:
            logger.warning(
                f"GPU has only {vram:.1f}GB VRAM. 4-bit QLoRA needs ~5GB minimum. "
                "Consider reducing TRAIN_MAX_LENGTH or TRAIN_BATCH_SIZE."
            )
        return True, name
    except ImportError:
        return False, "CPU"


# ─── DB Status Update ─────────────────────────────────────────────────────────
def update_db_job_status(
    db_path: str,
    job_id: str,
    status: str,
    error: str | None = None,
    metrics: dict | None = None,
    adapter_path: str | None = None,
) -> None:
    """Update adapter_jobs row in SQLite — real status, no faking."""
    try:
        import sqlite3
        now = datetime.utcnow().isoformat()
        con = sqlite3.connect(db_path)
        cur = con.cursor()

        updates = ["status = ?", "updated_at = ?"]
        params: list = [status, now]

        if error:
            updates.append("error_message = ?")
            params.append(error)
        if metrics:
            updates.append("metrics = ?")
            params.append(json.dumps(metrics))
        if adapter_path:
            updates.append("output_adapter_path = ?")
            params.append(adapter_path)
        if status == "running":
            updates.append("started_at = ?")
            params.append(now)
        if status in ("completed", "failed"):
            updates.append("completed_at = ?")
            params.append(now)

        # Add 'updated_at' column if it doesn't exist (migration guard)
        try:
            cur.execute("ALTER TABLE adapter_jobs ADD COLUMN updated_at TEXT")
        except Exception:
            pass

        params.append(job_id)
        cur.execute(f"UPDATE adapter_jobs SET {', '.join(updates)} WHERE id = ?", params)
        con.commit()
        con.close()
        logger.info(f"DB updated: job {job_id[:8]}... → {status}")
    except Exception as e:
        logger.warning(f"Could not update DB status: {e}")


# ─── Training ─────────────────────────────────────────────────────────────────
def train(args: argparse.Namespace) -> None:
    validate_gemma4_model(args.model_id)
    has_cuda, gpu_name = check_gpu()

    if not has_cuda:
        msg = (
            "CUDA GPU not available. QLoRA training requires a CUDA-capable GPU.\n"
            "Your RTX 5050 should work — ensure PyTorch nightly cu128 is installed:\n"
            "  pip install --pre torch --index-url https://download.pytorch.org/whl/nightly/cu128"
        )
        logger.error(msg)
        if args.job_id and args.db_path:
            update_db_job_status(args.db_path, args.job_id, "failed", error=msg)
        sys.exit(1)

    # ── Validate dataset ──────────────────────────────────────────
    dataset_path = Path(args.dataset_path)
    if not dataset_path.exists():
        msg = f"Dataset not found: {dataset_path}. Generate it first via the API."
        logger.error(msg)
        if args.job_id and args.db_path:
            update_db_job_status(args.db_path, args.job_id, "failed", error=msg)
        sys.exit(1)

    with open(dataset_path) as f:
        examples = [json.loads(l) for l in f if l.strip()]

    if len(examples) < 10:
        msg = f"Dataset too small: {len(examples)} examples (need ≥10). Generate more memories first."
        logger.error(msg)
        if args.job_id and args.db_path:
            update_db_job_status(args.db_path, args.job_id, "failed", error=msg)
        sys.exit(1)

    logger.info(f"Dataset: {len(examples)} training examples from {dataset_path}")

    # ── Mark running ──────────────────────────────────────────────
    if args.job_id and args.db_path:
        update_db_job_status(args.db_path, args.job_id, "running")

    # ── Imports (only here to avoid slow startup if not training) ─
    try:
        import torch
        from transformers import (
            AutoTokenizer,
            AutoModelForCausalLM,
            BitsAndBytesConfig,
            TrainingArguments,
        )
        from peft import LoraConfig, get_peft_model, TaskType
        from trl import SFTTrainer, SFTConfig
        from datasets import Dataset
    except ImportError as e:
        msg = f"Missing training dependency: {e}. Install: pip install transformers peft trl bitsandbytes accelerate datasets"
        logger.error(msg)
        if args.job_id and args.db_path:
            update_db_job_status(args.db_path, args.job_id, "failed", error=msg)
        sys.exit(1)

    # ── Output dir ───────────────────────────────────────────────
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    logs_dir = output_dir / "logs"
    logs_dir.mkdir(exist_ok=True)

    log_file = logs_dir / f"training_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.log"
    file_handler = logging.FileHandler(log_file)
    file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(file_handler)

    logger.info(f"Output dir: {output_dir}")
    logger.info(f"Log file: {log_file}")

    # ── 4-bit NF4 quantization config ────────────────────────────
    # NF4 = best quality 4-bit for LLMs (from QLoRA paper)
    # float16 for compute dtype on Blackwell
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,  # nested quantization saves ~0.4GB
    )

    # ── Load tokenizer ────────────────────────────────────────────
    logger.info(f"Loading tokenizer: {args.model_id}")
    hf_token = args.hf_token or os.environ.get("HF_TOKEN") or None

    tokenizer = AutoTokenizer.from_pretrained(
        args.model_id,
        token=hf_token,
        trust_remote_code=True,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # ── Load model in 4-bit ───────────────────────────────────────
    logger.info(f"Loading model in NF4 4-bit: {args.model_id}")
    t0 = time.time()
    model = AutoModelForCausalLM.from_pretrained(
        args.model_id,
        quantization_config=bnb_config,
        device_map="auto",          # auto-places on RTX 5050
        token=hf_token,
        trust_remote_code=True,
        torch_dtype=torch.float16,
    )
    logger.info(f"Model loaded in {time.time()-t0:.1f}s")

    # ── LoRA config ───────────────────────────────────────────────
    # Target the attention and MLP projection layers
    lora_config = LoraConfig(
        r=args.lora_rank,
        lora_alpha=args.lora_alpha,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_dropout=0.05,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # ── Format dataset ────────────────────────────────────────────
    def format_example(ex: dict) -> str:
        """Convert JSONL example to Gemma 4 chat format."""
        messages = ex.get("messages", [])
        if not messages:
            # Legacy format: user_message / assistant_response
            user = ex.get("user_message", "")
            assistant = ex.get("assistant_response", "")
            messages = [
                {"role": "user", "content": user},
                {"role": "assistant", "content": assistant},
            ]
        text = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=False,
        )
        return text

    texts = [format_example(ex) for ex in examples]
    hf_dataset = Dataset.from_dict({"text": texts})

    # ── Training arguments ────────────────────────────────────────
    training_args = SFTConfig(
        output_dir=str(output_dir),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        fp16=True,
        bf16=False,
        optim="paged_adamw_32bit",     # memory-efficient optimizer for QLoRA
        logging_steps=5,
        save_strategy="epoch",
        evaluation_strategy="no",
        warmup_ratio=0.05,
        lr_scheduler_type="cosine",
        dataloader_pin_memory=False,
        report_to="none",              # no wandb/cloud logging
        max_seq_length=args.max_length,
        dataset_text_field="text",
    )

    # ── Train ─────────────────────────────────────────────────────
    trainer = SFTTrainer(
        model=model,
        train_dataset=hf_dataset,
        args=training_args,
        tokenizer=tokenizer,
    )

    logger.info("=" * 60)
    logger.info(f"Starting QLoRA training on {gpu_name}")
    logger.info(f"  Model:          {args.model_id}")
    logger.info(f"  Dataset size:   {len(examples)} examples")
    logger.info(f"  Epochs:         {args.epochs}")
    logger.info(f"  Batch size:     {args.batch_size} (grad_accum={args.grad_accum})")
    logger.info(f"  Effective batch:{args.batch_size * args.grad_accum}")
    logger.info(f"  LoRA rank/alpha:{args.lora_rank}/{args.lora_alpha}")
    logger.info(f"  Max length:     {args.max_length}")
    logger.info(f"  Learning rate:  {args.lr}")
    logger.info("=" * 60)

    t_start = time.time()
    train_result = trainer.train()
    t_elapsed = time.time() - t_start

    # ── Save adapter ──────────────────────────────────────────────
    adapter_path = output_dir / "persona_adapter"
    model.save_pretrained(str(adapter_path))
    tokenizer.save_pretrained(str(adapter_path))

    # ── Write metrics ─────────────────────────────────────────────
    metrics = {
        "model": args.model_id,
        "gpu": gpu_name,
        "dataset_size": len(examples),
        "epochs": args.epochs,
        "lora_rank": args.lora_rank,
        "lora_alpha": args.lora_alpha,
        "batch_size": args.batch_size,
        "grad_accum": args.grad_accum,
        "max_length": args.max_length,
        "learning_rate": args.lr,
        "train_loss": round(train_result.training_loss, 4),
        "train_runtime_seconds": round(t_elapsed, 1),
        "adapter_path": str(adapter_path),
        "completed_at": datetime.utcnow().isoformat(),
        "quantization": "NF4 4-bit (QLoRA)",
    }

    metrics_path = output_dir / "training_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info("=" * 60)
    logger.info(f"Training complete in {t_elapsed:.0f}s ({t_elapsed/60:.1f} min)")
    logger.info(f"Final loss: {train_result.training_loss:.4f}")
    logger.info(f"Adapter saved: {adapter_path}")
    logger.info(f"Metrics saved: {metrics_path}")
    logger.info("=" * 60)

    if args.job_id and args.db_path:
        update_db_job_status(
            args.db_path,
            args.job_id,
            "completed",
            metrics=metrics,
            adapter_path=str(adapter_path),
        )


# ─── Entry Point ──────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Afterlight QLoRA Persona Adapter Training (Gemma 4 only)"
    )
    parser.add_argument("--space_id", required=True)
    parser.add_argument("--dataset_path", required=True)
    parser.add_argument("--output_dir", required=True)
    parser.add_argument("--model_id", default="google/gemma-4-e2b-it")
    parser.add_argument("--job_id", default="")
    parser.add_argument("--db_path", default="./storage/afterlight.db")
    parser.add_argument("--hf_token", default="")
    parser.add_argument("--lora_rank", type=int, default=16)
    parser.add_argument("--lora_alpha", type=int, default=32)
    parser.add_argument("--batch_size", type=int, default=1)
    parser.add_argument("--grad_accum", type=int, default=4)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--max_length", type=int, default=512)
    args = parser.parse_args()

    try:
        train(args)
    except KeyboardInterrupt:
        logger.info("Training interrupted by user.")
        if args.job_id and args.db_path:
            update_db_job_status(args.db_path, args.job_id, "failed", error="Interrupted")
        sys.exit(1)
    except Exception as e:
        logger.exception(f"Training failed: {e}")
        if args.job_id and args.db_path:
            update_db_job_status(args.db_path, args.job_id, "failed", error=str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
