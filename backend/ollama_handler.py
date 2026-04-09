"""
Ollama Chat Handler for SmartStudy Abroad
Connects to local Ollama API (Mistral 7B) for the AI chatbot.

WHY LOCAL LLM?
- Fast: GPU-accelerated on user's RTX 4050, no internet needed
- Free: No API costs, runs entirely on local hardware
- Private: Student data never leaves the machine

HOW IT WORKS:
1. System prompt restricts the LLM to university/study-abroad topics only
2. RAG search results are injected as context so the LLM can explain recommendations
3. Conversation history is passed for multi-turn dialogue
"""

import requests
import json
import re


# System prompt — rich university advisor with ML+RAG knowledge
SYSTEM_PROMPT = """You are an expert university advisor for SmartStudy Abroad, powered by ML prediction and a RAG knowledge base of 232+ universities worldwide.

YOUR CAPABILITIES:
- You have access to ML-predicted admission probabilities for the student based on their GPA, IELTS, GRE, SAT, research experience, extracurriculars, and budget.
- You know detailed info about universities: tuition, deadlines, scholarships, acceptance rates, research focus, program duration, work visa availability, QS rankings, and more.
- You can recommend universities BEYOND what's shown on screen — you know about additional matches the student hasn't seen yet.
- You understand gap analysis: what requirements the student meets, exceeds, or falls short of.

RULES:
- You ONLY answer questions about: universities, study abroad, admissions, tuition, scholarships, GPA requirements, English tests (TOEFL/IELTS), application deadlines, student visas, career prospects, and student life abroad.
- If a user asks about anything unrelated, politely redirect: "I'm a university advisor — I can help with study abroad topics! Ask me about universities, admissions, scholarships, or how to improve your profile."
- Give DETAILED, data-driven answers. Use specific numbers (tuition, GPA, QS ranking, acceptance rate, admission probability).
- When comparing universities, create structured comparisons with pros/cons.
- When asked "which should I choose", consider: admission chance, cost, ranking, scholarships, work visa, research fit, and the student's profile.
- When asked about universities NOT in the shown results, check your extra universities list and recommend from there with full details.
- Proactively suggest alternatives and explain WHY — "University X has 75% admission chance for you because your GPA exceeds their 3.2 requirement and your IELTS is strong."
- When asked "how to improve", reference the improvement suggestions and explain specific steps.
- Be encouraging, specific, and thorough. Students are making life-changing decisions — give them the detail they need.
"""


class OllamaChat:
    """Handles communication with the local Ollama API.

    Ollama runs at http://localhost:11434 and exposes a REST API.
    We use the /api/chat endpoint which accepts messages in the same
    format as OpenAI (system/user/assistant roles).
    """

    def __init__(self, model="mistral:instruct", base_url="http://localhost:11434"):
        self.model = model
        self.base_url = base_url
        self.chat_url = f"{base_url}/api/chat"
        self.tags_url = f"{base_url}/api/tags"

    def is_available(self):
        """Check if Ollama is running and the model is loaded.

        Pings /api/tags to get list of available models.
        Returns (True, model_info) or (False, error_message).
        """
        try:
            resp = requests.get(self.tags_url, timeout=5)
            if resp.status_code == 200:
                models = resp.json().get("models", [])
                model_names = [m.get("name", "") for m in models]
                # Check if our model is available (match partial name)
                for name in model_names:
                    if self.model.split(":")[0] in name:
                        return True, f"Model '{name}' ready"
                return False, f"Model '{self.model}' not found. Available: {model_names}"
            return False, f"Ollama returned status {resp.status_code}"
        except requests.ConnectionError:
            return False, "Ollama is not running. Start it with: ollama serve"
        except Exception as e:
            return False, f"Error checking Ollama: {e}"

    def chat(self, message, history=None, rag_context=None):
        """Send a message to Ollama and get a response.

        Args:
            message: The user's current message text
            history: List of prior messages [{role: 'user'|'assistant', content: '...'}]
            rag_context: List of matched universities from RAG (dicts with name, country, etc.)

        Returns:
            dict with 'response' (text) and 'model' (model name)
        """
        if history is None:
            history = []

        # Build the system prompt with optional RAG context
        system_content = SYSTEM_PROMPT
        if rag_context:
            system_content += "\n\n" + self._format_rag_context(rag_context)

        # Build messages array in Ollama format (same as OpenAI)
        # [system, ...history, user_message]
        messages = [{"role": "system", "content": system_content}]

        # Add conversation history (so LLM remembers prior messages)
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

        # Add current user message
        messages.append({"role": "user", "content": message})

        try:
            # Call Ollama API
            # stream=false means we get the full response at once (simpler)
            resp = requests.post(
                self.chat_url,
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,      # Balanced creativity
                        "num_predict": 1024,      # Allow detailed responses
                    }
                },
                timeout=120  # 2 minute timeout for slow first loads
            )

            if resp.status_code == 200:
                data = resp.json()
                response_text = data.get("message", {}).get("content", "")
                return {
                    "response": response_text.strip(),
                    "model": self.model
                }
            else:
                return {
                    "response": f"Ollama error (status {resp.status_code}). Is the model loaded?",
                    "model": self.model
                }

        except requests.Timeout:
            return {
                "response": "The AI is taking too long. This might happen on the first message while the model loads into GPU memory. Please try again.",
                "model": self.model
            }
        except requests.ConnectionError:
            return {
                "response": "Cannot connect to Ollama. Please make sure Ollama is running (open Ollama app or run 'ollama serve').",
                "model": self.model
            }
        except Exception as e:
            return {
                "response": f"Chat error: {str(e)}",
                "model": self.model
            }

    def chat_stream(self, message, history=None, rag_context=None):
        """Stream a response from Ollama token-by-token.

        Yields chunks of text as they arrive from the model.
        This lets the frontend show "typing" effect in real-time.
        """
        if history is None:
            history = []

        system_content = SYSTEM_PROMPT
        if rag_context:
            system_content += "\n\n" + self._format_rag_context(rag_context)

        messages = [{"role": "system", "content": system_content}]
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": message})

        try:
            resp = requests.post(
                self.chat_url,
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": 1024,
                    }
                },
                timeout=120,
                stream=True,
            )

            if resp.status_code == 200:
                for line in resp.iter_lines():
                    if line:
                        try:
                            chunk = json.loads(line)
                            token = chunk.get("message", {}).get("content", "")
                            if token:
                                yield token
                            if chunk.get("done"):
                                break
                        except json.JSONDecodeError:
                            continue
            else:
                yield f"Ollama error (status {resp.status_code})"

        except requests.Timeout:
            yield "The AI is taking too long. Please try again."
        except requests.ConnectionError:
            yield "Cannot connect to Ollama. Please make sure Ollama is running."
        except Exception as e:
            yield f"Chat error: {str(e)}"

    def extract_preferences(self, message):
        """Use Mistral to extract structured search preferences from a messy user message.

        WHY USE THE LLM FOR THIS?
        - Users type with typos: "compter sience" → "Computer Science"
        - Users use slang: "cheap uni in caneda" → {country: Canada, budget intent: affordable}
        - Users mix languages or abbreviations: "CS in UK under 30k" → structured data

        Mistral understands all of this. Much better than keyword matching.

        Returns dict like: {field, degree, country, budget, free_text} or None if not a search request.
        """
        extraction_prompt = """Extract university search preferences from this user message.
Return ONLY a JSON object with these fields (use null for anything not mentioned):
{
  "field": "the field of study (corrected spelling)",
  "degree": "Master or Bachelor or PhD",
  "country": "country name (corrected spelling)",
  "budget": number or null,
  "gpa": number or null,
  "free_text": "the original message cleaned up",
  "is_search": true or false
}

Set "is_search" to true ONLY if the user is asking for university suggestions/recommendations.
Set it to false if they're asking general questions (what is IELTS, how to apply, etc.)

Examples:
"suggest me affordable CS universities in Canada" → {"field": "Computer Science", "degree": "Master", "country": "Canada", "budget": null, "free_text": "affordable computer science", "is_search": true}
"compter sience in caneda under 30k" → {"field": "Computer Science", "degree": "Master", "country": "Canada", "budget": 30000, "free_text": "affordable computer science", "is_search": true}
"what is IELTS?" → {"is_search": false}
"best MBA programs" → {"field": "MBA", "degree": "Master", "country": null, "budget": null, "free_text": "best MBA programs", "is_search": true}

Return ONLY the JSON, nothing else."""

        try:
            resp = requests.post(
                self.chat_url,
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": extraction_prompt},
                        {"role": "user", "content": message}
                    ],
                    "stream": False,
                    "options": {
                        "temperature": 0.1,   # Low temperature = more precise extraction
                        "num_predict": 200,
                    }
                },
                timeout=30
            )

            if resp.status_code == 200:
                text = resp.json().get("message", {}).get("content", "").strip()
                # Extract JSON from response (Mistral might wrap it in markdown)
                json_match = re.search(r'\{[^{}]+\}', text, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group())
                    if parsed.get("is_search"):
                        return {
                            'field': parsed.get('field', ''),
                            'degree': parsed.get('degree', 'Master'),
                            'budget': parsed.get('budget', 0) or 0,
                            'gpa': parsed.get('gpa', 0) or 0,
                            'free_text': parsed.get('free_text', message),
                            'country': parsed.get('country'),
                        }
            return None
        except Exception as e:
            print(f"Preference extraction failed: {e}")
            return None

    def _format_rag_context(self, rag_context):
        """Format ML+RAG search results into rich text the LLM can understand.

        Handles two formats:
        1. Rich dict: {student_profile, ml_summary, shown_universities, extra_universities}
        2. Legacy list: [{name, country, ...}, ...]
        """
        if not rag_context:
            return ""

        # Handle new rich format (dict with student profile + ML summary)
        if isinstance(rag_context, dict) and 'student_profile' in rag_context:
            return self._format_rich_context(rag_context)

        # Legacy format: flat list of universities
        if isinstance(rag_context, list):
            shown = rag_context[:5]
            extra = rag_context[5:]
            lines = ["SEARCH RESULTS (shown on screen):"]
            for i, uni in enumerate(shown, 1):
                lines.append(self._format_one_university(i, uni))
            if extra:
                lines.append("\nADDITIONAL UNIVERSITIES (not shown, but you can recommend):")
                for i, uni in enumerate(extra, 1):
                    lines.append(self._format_one_university(i, uni))
            return "\n".join(lines)

        return ""

    def _format_rich_context(self, ctx):
        """Format the rich ML+RAG context for the LLM."""
        lines = []

        # Student profile
        profile = ctx.get('student_profile', {})
        if profile:
            lines.append("=== STUDENT PROFILE ===")
            lines.append(f"GPA: {profile.get('gpa', 'N/A')}")
            if profile.get('ielts'):
                lines.append(f"IELTS: {profile['ielts']}")
            if profile.get('gre'):
                lines.append(f"GRE: {profile['gre']}")
            if profile.get('sat'):
                lines.append(f"SAT: {profile['sat']}")
            lines.append(f"Research Experience: {'Yes' if profile.get('research_exp') else 'No'}")
            lines.append(f"Extracurricular Level: {profile.get('eca_level', 0)}/5")
            if profile.get('budget'):
                lines.append(f"Budget: ${profile['budget']:,.0f}/year")
            lines.append(f"Field: {profile.get('field', 'N/A')}")
            if profile.get('preferred_country'):
                lines.append(f"Preferred Country: {profile['preferred_country']}")
            lines.append("")

        # ML summary
        ml = ctx.get('ml_summary', {})
        if ml:
            lines.append("=== ML PREDICTION SUMMARY ===")
            lines.append(f"Overall Admission Probability: {ml.get('overall_probability', 0)}% ({ml.get('confidence', '')})")
            cc = ml.get('category_counts', {})
            if cc:
                lines.append(f"Out of {ml.get('total_universities', 232)} universities:")
                lines.append(f"  Safe (>=85%): {cc.get('safe', 0)} universities")
                lines.append(f"  Moderate (65-84%): {cc.get('moderate', 0)} universities")
                lines.append(f"  Risky (<65%): {cc.get('risky', 0)} universities")
            if ml.get('recommendation'):
                lines.append(f"Recommendation: {ml['recommendation']}")

            improvements = ml.get('improvements', [])
            if improvements:
                lines.append("\nIMPROVEMENT SUGGESTIONS:")
                for imp in improvements:
                    lines.append(f"  - {imp['action']} -> {imp['impact']}")
            lines.append("")

        # Shown universities (top 5 on screen)
        shown = ctx.get('shown_universities', [])
        if shown:
            lines.append(f"=== TOP {len(shown)} UNIVERSITIES (shown on screen) ===")
            for i, uni in enumerate(shown, 1):
                lines.append(self._format_one_university(i, uni))
            lines.append("")

        # Extra universities (6-30, not shown but LLM can recommend)
        extra = ctx.get('extra_universities', [])
        if extra:
            lines.append(f"=== {len(extra)} MORE UNIVERSITIES (NOT shown on screen — you can recommend these!) ===")
            lines.append("The student hasn't seen these yet. Proactively suggest them when relevant.")
            lines.append("")
            for i, uni in enumerate(extra, 1):
                lines.append(self._format_one_university(i, uni))
            lines.append("")

        # Instructions
        lines.append("=== CHAT INSTRUCTIONS ===")
        lines.append("- Use SPECIFIC data (admission %, tuition, GPA, QS ranking) in every answer.")
        lines.append("- When asked 'why X', explain using gap analysis (what the student meets/exceeds/lacks).")
        lines.append("- When asked 'compare', make a structured comparison with pros/cons.")
        lines.append("- When asked for alternatives, recommend from the EXTRA universities list — explain WHY they're good fits.")
        lines.append("- When asked 'how to improve', use the improvement suggestions + specific targets.")
        lines.append("- You can recommend ANY university from both lists. The extra list has universities the student hasn't seen yet.")
        lines.append("- Be thorough and detailed. This is a life-changing decision for the student.")

        return "\n".join(lines)

    def _format_one_university(self, index, uni):
        """Format a single university entry with full ML + RAG data."""
        name = uni.get("name", "Unknown")
        country = uni.get("country", "")
        score = uni.get("match_score", 0)
        category = uni.get("category", "")
        tuition = uni.get("tuition", "N/A")
        min_gpa = uni.get("min_gpa", uni.get("gpa_required", ""))
        field = uni.get("field", "")
        degree = uni.get("degree", "")
        ielts = uni.get("ielts", uni.get("ielts_requirement", 0))
        toefl = uni.get("toefl", 0)
        scholarships = uni.get("scholarships", "")
        qs = uni.get("qs_ranking", "")
        acceptance = uni.get("acceptance_rate", "")
        work_visa = uni.get("work_visa_available", "")
        research_focus = uni.get("research_focus", "")
        program_duration = uni.get("program_duration", "")
        deadline_fall = uni.get("deadline_fall", "")
        deadline_spring = uni.get("deadline_spring", "")
        english_req = uni.get("english_requirements", "")
        test_req = uni.get("test_requirements", "")
        living_cost = uni.get("living_cost", 0)
        total_cost = uni.get("total_cost_estimated", 0)
        max_coverage = uni.get("max_coverage_percent", 0)
        programs = uni.get("programs_offered", "")
        gaps = uni.get("gap_analysis", [])
        reasons = uni.get("reasons", [])

        line = f"{index}. {name} ({country})"
        line += f" — {score}% admission probability"
        if category:
            line += f" [{category}]"
        line += f"\n   Tuition: {tuition}"
        if min_gpa:
            line += f" | GPA required: {min_gpa}"
        if qs:
            line += f" | QS Ranking: #{qs}"
        if acceptance:
            line += f" | Acceptance rate: {acceptance}%"

        details = []
        if ielts:
            details.append(f"IELTS: {ielts}")
        if toefl:
            details.append(f"TOEFL: {toefl}")
        if english_req:
            details.append(f"English: {english_req}")
        if test_req:
            details.append(f"Tests: {test_req}")
        if details:
            line += f"\n   Requirements: {', '.join(details)}"

        extras = []
        if scholarships:
            extras.append(f"Scholarships: {scholarships}")
        if max_coverage:
            extras.append(f"Max coverage: {max_coverage}%")
        if work_visa:
            extras.append("Work visa available")
        if extras:
            line += f"\n   {', '.join(extras)}"

        info = []
        if program_duration:
            info.append(f"Duration: {program_duration}")
        if research_focus:
            info.append(f"Research: {research_focus}")
        if programs:
            info.append(f"Programs: {programs}")
        if living_cost:
            info.append(f"Living cost: ${living_cost:,.0f}/yr" if isinstance(living_cost, (int, float)) else f"Living cost: {living_cost}")
        if total_cost:
            info.append(f"Total cost: ${total_cost:,.0f}/yr" if isinstance(total_cost, (int, float)) else f"Total cost: {total_cost}")
        if info:
            line += f"\n   {', '.join(info)}"

        deadlines = []
        if deadline_fall:
            deadlines.append(f"Fall: {deadline_fall}")
        if deadline_spring:
            deadlines.append(f"Spring: {deadline_spring}")
        if deadlines:
            line += f"\n   Deadlines: {', '.join(deadlines)}"

        if gaps:
            gap_strs = []
            for g in gaps:
                status_icon = '+' if g.get('status') == 'strong' else ('=' if g.get('status') == 'meets' else '-')
                gap_strs.append(f"[{status_icon}] {g.get('detail', '')}")
            line += f"\n   Gap analysis: {'; '.join(gap_strs)}"

        if reasons:
            line += f"\n   Reasons: {'; '.join(reasons)}"

        return line
