from flask import Flask, request, jsonify, render_template  # Import modules for handling requests and JSON responses.

app = Flask(__name__)  # Create the Flask app.

# Define a dictionary of problematic terms and their feedback.
problematic_terms = {
    "chairman": "Consider using 'chairperson' instead.",
    "fireman": "Consider using 'firefighter' instead.",
    "mankind": "Consider using 'humankind' instead."
}

from flask import render_template  # Import render_template for rendering HTML templates.

@app.route("/")  # Root endpoint.
def input_text():
    return render_template("index.html")  # Render and return the index.html template.

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    input_text = data['text']

    # Example problematic terms with feedback
    terms_feedback = {
        "chairman": "Use 'chairperson' instead.",
        "fireman": "Use 'firefighter' instead.",
        "stewardess": "Use 'flight attendant' instead."
    }

    analysis_results = []

    # Tokenize text and check for problematic terms
    for term, feedback in terms_feedback.items():
        if term in input_text:
            analysis_results.append({
                "term": term,
                "feedback": feedback
            })

    return jsonify({
        "input_text": input_text,
        "analysis": analysis_results
    })


if __name__ == "__main__":
    app.run(debug=True)  # Run the app in debug mode.
