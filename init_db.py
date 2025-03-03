import sqlite3
import os
import sys
import logging

# Set up logging to output to console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Database path
DB_PATH = "terms.db"

def init_database():
    """Initialize the database with required tables and sample data"""
    print(f"Initializing database at {DB_PATH}...")
    
    # Check if database exists
    db_exists = os.path.exists(DB_PATH)
    if db_exists:
        print(f"Found existing database at {DB_PATH}")
    else:
        print(f"Creating new database at {DB_PATH}")
    
    # Connect to the database
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Create tables
        print("Creating necessary tables...")
        
        # Create categories table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
        ''')
        
        # Create sources table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
        ''')
        
        # Create problematic_terms table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS problematic_terms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            term TEXT NOT NULL,
            pattern TEXT,
            feedback TEXT NOT NULL,
            category_id INTEGER,
            source_id INTEGER,
            FOREIGN KEY (category_id) REFERENCES categories (id),
            FOREIGN KEY (source_id) REFERENCES sources (id)
        )
        ''')
        
        # Create topics table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL UNIQUE,
            terms TEXT NOT NULL
        )
        ''')
        
        conn.commit()
        print("Tables created successfully")
        
        # Check if tables already have data
        cursor.execute("SELECT COUNT(*) FROM problematic_terms")
        terms_count = cursor.fetchone()[0]
        print(f"Found {terms_count} existing terms in the database")
        
        # Insert sample data if terms table is empty
        if terms_count == 0:
            print("Adding sample data to all tables...")
            
            # Add sample categories
            categories = [
                ("Gender",),
                ("Race & Ethnicity",),
                ("Disability",),
                ("Age",),
                ("General",)
            ]
            cursor.executemany("INSERT OR IGNORE INTO categories (name) VALUES (?)", categories)
            print(f"Added {len(categories)} categories")
            
            # Add sample sources
            sources = [
                ("Internal Guidelines",),
                ("Diversity Style Guide",),
                ("Conscious Style Guide",),
                ("AP Stylebook",)
            ]
            cursor.executemany("INSERT OR IGNORE INTO sources (name) VALUES (?)", sources)
            print(f"Added {len(sources)} sources")
            
            # Add sample problematic terms
            terms = [
                ("guys", None, "Consider using more inclusive terms like 'everyone', 'folks', 'team', or 'people'.", 1, 1),
                ("wheelchair bound", None, "Consider 'wheelchair user' or 'person who uses a wheelchair' instead.", 3, 2),
                ("elderly", None, "Consider more specific terms like 'older adults' or specific age ranges.", 4, 3),
                ("minority", None, "Consider more specific descriptors of the group being referenced.", 2, 1),
                ("crazy", None, "Consider more precise terms like 'wild', 'intense', or 'unpredictable'.", 5, 3)
            ]
            cursor.executemany(
                "INSERT INTO problematic_terms (term, pattern, feedback, category_id, source_id) VALUES (?, ?, ?, ?, ?)",
                terms
            )
            print(f"Added {len(terms)} problematic terms")
        
        # Check if topics table has data regardless of terms data
        cursor.execute("SELECT COUNT(*) FROM topics")
        topics_count = cursor.fetchone()[0]
        print(f"Found {topics_count} existing topics in the database")
        
        # Add sample topics data if the table is empty
        if topics_count == 0:
            print("Adding sample topics...")
            topics = [
                ("Gender Inclusivity", "gender, pronoun, inclusive, diversity, equity"),
                ("Racial Equity", "race, ethnicity, cultural, diverse, inclusion"),
                ("Disability", "disability, accessible, accommodation, inclusive design"),
                ("Age Discrimination", "age, ageism, elderly, older, retirement"),
                ("General Inclusivity", "inclusive, diversity, equity, belonging, accessibility")
            ]
            cursor.executemany("INSERT INTO topics (topic, terms) VALUES (?, ?)", topics)
            print(f"Added {len(topics)} topics")
            
            conn.commit()
        
        # Verify tables were created properly
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [table[0] for table in cursor.fetchall() if not table[0].startswith('sqlite_')]
        print(f"Tables in database: {', '.join(tables)}")
        
        # Verify topics table has data
        cursor.execute("SELECT COUNT(*) FROM topics")
        topics_count = cursor.fetchone()[0]
        print(f"Final topics count in database: {topics_count}")
        
        print("Database initialization complete!")
        return True
        
    except sqlite3.Error as e:
        print(f"SQLite error: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    init_database() 