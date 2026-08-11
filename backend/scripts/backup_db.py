import os
import shutil
from pathlib import Path
from django.utils import timezone

def backup_sqlite():
    # Base dir of backend
    backend_dir = Path(__file__).resolve().parent.parent
    db_file = backend_dir / 'db.sqlite3'
    
    if not db_file.exists():
        print(f"Error: Database file not found at {db_file}")
        return
        
    backups_dir = backend_dir / 'backups'
    os.makedirs(backups_dir, exist_ok=True)
    
    timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
    backup_file = backups_dir / f'db_backup_{timestamp}.sqlite3'
    
    shutil.copy2(db_file, backup_file)
    print(f"Success: Database backup created at {backup_file}")

if __name__ == '__main__':
    # Set up Django environment to use timezone if needed
    import sys
    backend_dir = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(backend_dir))
    
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    import django
    django.setup()
    backup_sqlite()
