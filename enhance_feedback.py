import sqlite3
import logging
import sys

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

# Enhanced feedback data
enhanced_feedback = [
    # Gender-related terms
    (
        "guys", 
        "While commonly used to address mixed-gender groups, 'guys' has masculine connotations that may not be inclusive to everyone. Consider using more gender-neutral alternatives such as:\n"
        "- 'everyone' or 'everybody'\n"
        "- 'folks' or 'y'all'\n"
        "- 'team' or 'all'\n"
        "- 'people' or 'colleagues'\n\n"
        "Example: Instead of 'Hey guys, let's get started,' try 'Hey everyone, let's get started.'"
    ),
    (
        "mankind", 
        "The term 'mankind' centers masculine language as universal. Consider using more inclusive terms such as:\n"
        "- 'humanity' or 'humankind'\n"
        "- 'people' or 'human beings'\n"
        "- 'the human race'\n\n"
        "Example: Instead of 'the achievements of mankind,' try 'the achievements of humanity.'"
    ),
    (
        "manpower", 
        "The term 'manpower' unnecessarily uses gendered language for a concept that isn't inherently gendered. Consider alternatives such as:\n"
        "- 'workforce' or 'staff'\n"
        "- 'personnel' or 'workers'\n"
        "- 'human resources' or 'labor'\n\n"
        "Example: Instead of 'we need more manpower,' try 'we need more personnel.'"
    ),
    
    # Disability-related terms
    (
        "wheelchair bound", 
        "This phrase incorrectly suggests that wheelchairs confine or limit users, when in fact they enable mobility and independence. More respectful alternatives include:\n"
        "- 'wheelchair user'\n"
        "- 'person who uses a wheelchair'\n"
        "- 'person who uses mobility equipment'\n\n"
        "Example: Instead of 'She is wheelchair bound,' try 'She is a wheelchair user.'"
    ),
    (
        "handicapped", 
        "Many people with disabilities consider 'handicapped' outdated terminology that focuses on limitation rather than capability. Consider person-first or identity-first language such as:\n"
        "- 'person with a disability'\n"
        "- 'disabled person' (when preferred by the individual)\n"
        "- specific references to the particular disability when relevant and known\n\n"
        "For facilities: use 'accessible parking' rather than 'handicapped parking'"
    ),
    (
        "special needs", 
        "The term 'special needs' can unnecessarily emphasize difference and has been critiqued by many disability advocates. Consider alternatives such as:\n"
        "- 'accessibility needs' or 'accommodations'\n"
        "- 'learning supports' (in educational contexts)\n"
        "- specific references to the actual needs or accommodations\n\n"
        "Example: Instead of 'special needs classroom,' try 'classroom with additional learning supports.'"
    ),
    
    # Age-related terms
    (
        "elderly", 
        "The term 'elderly' can carry negative connotations and homogenize a diverse age group. Consider alternatives such as:\n"
        "- 'older adults' or 'older people'\n"
        "- specific age ranges (e.g., 'adults over 65')\n"
        "- 'seniors' or 'senior citizens' (though preferences vary)\n\n"
        "Example: Instead of 'services for the elderly,' try 'services for older adults.'"
    ),
    (
        "senior moment", 
        "This phrase perpetuates stereotypes about cognitive decline in older adults. Consider alternatives such as:\n"
        "- 'momentary lapse' or 'slip of the mind'\n"
        "- 'forgot for a moment'\n"
        "- language that doesn't connect forgetfulness with age\n\n"
        "Example: Instead of 'I had a senior moment,' try 'I had a momentary lapse.'"
    ),
    
    # Race & Ethnicity-related terms
    (
        "minority", 
        "The term 'minority' can be imprecise and may imply marginality or 'less than' status. Consider alternatives such as:\n"
        "- naming the specific group being referenced\n"
        "- 'historically underrepresented group'\n"
        "- 'people of color' (when referencing non-white racial groups collectively)\n"
        "- 'global majority' (as BIPOC individuals represent a global majority)\n\n"
        "Example: Instead of 'minority students,' specify 'Black and Latino students' or use 'students from underrepresented groups.'"
    ),
    (
        "exotic", 
        "When applied to people, cultures, or cultural elements, 'exotic' emphasizes otherness and difference from a presumed Western/white norm. Consider alternatives such as:\n"
        "- specific, descriptive language about what makes something distinctive\n"
        "- 'unfamiliar' (if referring to your own perspective)\n"
        "- 'unique' or 'distinctive' (without racializing)\n\n"
        "Example: Instead of 'exotic features,' try describing the specific features or avoid commenting on appearance based on racial characteristics."
    ),
    
    # General terms
    (
        "crazy", 
        "This term trivializes mental health conditions and can perpetuate stigma. Consider alternatives that more precisely communicate your meaning:\n"
        "- For unusual situations: 'wild,' 'intense,' 'unexpected,' 'surprising'\n"
        "- For behavior: 'erratic,' 'unpredictable,' 'irrational'\n"
        "- For excitement: 'enthusiastic,' 'passionate,' 'thrilled'\n\n"
        "Example: Instead of 'The meeting was crazy,' try 'The meeting was intense.'"
    ),
    (
        "OCD", 
        "Using OCD (Obsessive-Compulsive Disorder) casually to describe organization or perfectionism trivializes a serious mental health condition. Consider alternatives such as:\n"
        "- 'detail-oriented' or 'thorough'\n"
        "- 'meticulous' or 'precise'\n"
        "- 'organized' or 'particular'\n\n"
        "Example: Instead of 'I'm so OCD about my desk,' try 'I'm very particular about keeping my desk organized.'"
    ),
    (
        "tone deaf", 
        "This phrase uses a reference to actual deafness or hearing impairment to describe insensitivity, which can be ableist. Consider alternatives such as:\n"
        "- 'insensitive' or 'unaware'\n"
        "- 'out of touch'\n"
        "- 'missing the point'\n\n"
        "Example: Instead of 'Their message was tone deaf,' try 'Their message was insensitive to the situation.'"
    )
]

def update_feedback():
    """Updates the database with enhanced feedback for existing terms and adds new terms"""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get existing terms
        cursor.execute("SELECT term FROM problematic_terms")
        existing_terms = [row[0] for row in cursor.fetchall()]
        
        # Get category and source IDs
        cursor.execute("SELECT id, name FROM categories")
        categories = {name: id for id, name in cursor.fetchall()}
        
        cursor.execute("SELECT id, name FROM sources")
        sources = {name: id for id, name in cursor.fetchall()}
        
        # Default category and source if not specified
        default_category_id = categories.get("General", 5)
        default_source_id = sources.get("Internal Guidelines", 1)
        
        # Create mapping for term categories
        term_categories = {
            "guys": "Gender",
            "mankind": "Gender",
            "manpower": "Gender",
            "wheelchair bound": "Disability",
            "handicapped": "Disability",
            "special needs": "Disability",
            "elderly": "Age",
            "senior moment": "Age",
            "minority": "Race & Ethnicity",
            "exotic": "Race & Ethnicity",
            "crazy": "General",
            "OCD": "General",
            "tone deaf": "General"
        }
        
        updated_count = 0
        added_count = 0
        
        for term, feedback in enhanced_feedback:
            category_name = term_categories.get(term, "General")
            category_id = categories.get(category_name, default_category_id)
            
            if term in existing_terms:
                # Update existing term
                cursor.execute(
                    "UPDATE problematic_terms SET feedback = ?, category_id = ? WHERE term = ?",
                    (feedback, category_id, term)
                )
                updated_count += 1
                logger.info(f"Updated feedback for term: {term}")
            else:
                # Add new term
                cursor.execute(
                    "INSERT INTO problematic_terms (term, pattern, feedback, category_id, source_id) VALUES (?, ?, ?, ?, ?)",
                    (term, None, feedback, category_id, default_source_id)
                )
                added_count += 1
                logger.info(f"Added new term: {term}")
        
        conn.commit()
        logger.info(f"Successfully updated {updated_count} terms and added {added_count} new terms.")
        
        # Display updated database stats
        cursor.execute("SELECT COUNT(*) FROM problematic_terms")
        terms_count = cursor.fetchone()[0]
        logger.info(f"Database now contains {terms_count} terms with improved feedback.")
        
        return True
    except sqlite3.Error as e:
        logger.error(f"SQLite error: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    logger.info("Enhancing feedback in database...")
    success = update_feedback()
    if success:
        logger.info("Feedback enhancement completed successfully.")
    else:
        logger.error("Feedback enhancement failed.") 