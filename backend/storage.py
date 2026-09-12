import os
import re
from pathlib import Path
from typing import Optional, Tuple

VAULT_DIR = Path(__file__).resolve().parent / "vault"

def ensure_vault_dir() -> Path:
    VAULT_DIR.mkdir(parents=True, exist_ok=True)
    return VAULT_DIR

def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r'[\\/*?:"<>|]', "_", name.strip())
    return cleaned if cleaned else "Untitled"

def get_relative_path(folder_name: Optional[str], title: str) -> str:
    filename = f"{sanitize_filename(title)}.md"
    if folder_name and folder_name.strip() and folder_name.strip().lower() != "root":
        clean_folder = sanitize_filename(folder_name.strip())
        return str(Path(clean_folder) / filename)
    return filename

def write_note_file(relative_path: str, content: str) -> Path:
    ensure_vault_dir()
    full_path = VAULT_DIR / relative_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
    return full_path

def read_note_file(relative_path: str) -> str:
    ensure_vault_dir()
    full_path = VAULT_DIR / relative_path
    if not full_path.exists():
        return ""
    with open(full_path, "r", encoding="utf-8") as f:
        return f.read()

def delete_note_file(relative_path: str) -> bool:
    ensure_vault_dir()
    full_path = VAULT_DIR / relative_path
    if full_path.exists():
        try:
            full_path.unlink()
            return True
        except Exception:
            return False
    return False

def move_note_file(old_relative_path: str, new_relative_path: str) -> Optional[Path]:
    ensure_vault_dir()
    old_full = VAULT_DIR / old_relative_path
    new_full = VAULT_DIR / new_relative_path
    if not old_full.exists():
        return None
    new_full.parent.mkdir(parents=True, exist_ok=True)
    if new_full.exists() and new_full != old_full:
        raise FileExistsError(f"A vault file already exists at {new_relative_path}")
    old_full.rename(new_full)
    return new_full

def list_all_vault_files() -> list[dict]:
    ensure_vault_dir()
    results = []
    for root, _, files in os.walk(VAULT_DIR):
        for f in files:
            if f.endswith((".md", ".markdown", ".txt")):
                full = Path(root) / f
                rel = full.relative_to(VAULT_DIR)
                results.append({
                    "relative_path": str(rel),
                    "size_bytes": full.stat().st_size,
                    "mtime": full.stat().st_mtime
                })
    return results
