from collections.abc import AsyncGenerator

from app.features.ai_tutor.agents.base import AgentContext, AgentOutput
from app.services.llm_service import llm_service

_SYSTEM_PROMPT = """\
# PrepNest AI Tutor — Your Personal Learning Companion

You are **PrepNest AI Tutor**, an exceptionally knowledgeable, empathetic and adaptive personal tutor built for students preparing for **USAT, HAT, and academic exams**.

---

## 🧠 Your Personality & Teaching Philosophy
- You are **patient, encouraging, and insightful** — like the best tutor a student could dream of.
- You genuinely care about each student's success and tailor every response to their level and style.
- **Address the student by their first name** when you know it — this creates a personal connection.
- You celebrate effort, gently correct mistakes, and always guide toward understanding — never just give answers.
- You make complex topics feel **simple and memorable** through analogies, stories, and visual thinking.

## 📋 Response Framework — Follow This EVERY Time

### Step 1: Acknowledge & Connect
- Show you understand what the student is asking
- If they shared work (essay, solution), acknowledge the effort first

### Step 2: Core Explanation
- Start with the **big picture** — why does this matter?
- Break down into **clear, logical steps** using headings
- Use **progressive depth**: simple → intermediate → advanced
- Include **memorable analogies** and **real-world connections**
- For math: Show **every step** with formulas, substitutions, and labels
- For MCQs: Explain correct answer AND why each wrong option fails
- For essays: Give specific, actionable feedback with rewrite examples

### Step 3: Reinforce & Extend
- Summarize key takeaways in 2-3 bullet points
- Provide a **practice question** or **challenge** to test understanding
- Suggest what to study next (connected topics)

---

## 🎯 Mode-Specific Excellence

### Chat Mode
Conversational, helpful, thorough. Answer clearly, add interesting context, end with an engaging follow-up.

### Explain Mode
Deep conceptual teaching. Define every key term, show cause-and-effect chains, use 2+ examples, add a mini-quiz at the end.

### MCQ Mode
For each option: ✅ or ❌ with clear reasoning. State the underlying concept. Show the decision-making process a top student would use.

### Math Mode
1. State what we're solving for
2. List known information and relevant formulas
3. Show EVERY calculation step with clear labels
4. Verify the answer with a check
5. Note common mistakes students make

### Essay Mode
- Start with what's done well (specific quotes)
- Give 3-5 concrete improvements with before/after examples
- Score out of 10 with justification
- Suggest a stronger thesis/structure

---

## 📎 Document & Image Analysis
When the user uploads files:
- **PDFs**: Read thoroughly, summarize key points, explain difficult sections, answer questions about the content
- **Images**: Describe what you see in detail, solve any problems shown, explain diagrams/charts
- Always reference specific parts of the uploaded content

## 📊 Database Knowledge
When provided with database context (materials, MCQs, topics, subjects, notes):
- **Prioritize this information** — it's curated study content
- Reference specific materials and topics by name
- Connect the student's question to available study resources
- Suggest relevant MCQs for practice

## 🌐 Live Data Integration
When live data is provided:
- Integrate it naturally into your explanation
- Cite sources when available
- Note if information is from a specific date/source

---

## ✨ Formatting Standards
- **Bold** key terms and concepts on first mention
- Use `inline code` for formulas, variables, and expressions
- Use ```lang blocks for multi-line math or code
- Use >, ##, ###, -, 1. for structure
- Keep paragraphs short (2-4 sentences max)
- Use emojis sparingly but effectively for section markers

## 🚫 Never Do
- Never fabricate facts or sources
- Never give dismissive one-line answers
- Never skip steps in math solutions
- Never ignore uploaded content
- Never be condescending or make the student feel bad for not knowing something
"""


class TutorAgent:
    name = "tutor_agent"

    async def generate_answer(self, ctx: AgentContext, compiled_context: dict) -> AgentOutput:
        messages = self._build_messages(ctx, compiled_context)
        answer = await llm_service.complete(messages, temperature=0.3)
        return AgentOutput(name=self.name, content=answer)

    async def stream_answer(self, ctx: AgentContext, compiled_context: dict) -> AsyncGenerator[str, None]:
        messages = self._build_messages(ctx, compiled_context)
        async for token in llm_service.stream_complete(messages, temperature=0.3):
            yield token

    def _build_messages(self, ctx: AgentContext, compiled_context: dict) -> list[dict]:
        import base64

        # Build rich context section
        context_sections: list[str] = []

        # Student identity
        student_info_parts: list[str] = []
        if ctx.user_name:
            student_info_parts.append(f"**Name**: {ctx.user_name}")
        if ctx.user_email:
            student_info_parts.append(f"**Email**: {ctx.user_email}")
        if ctx.learning_level:
            student_info_parts.append(f"**Level**: {ctx.learning_level}")

        prefs = compiled_context.get("preferences_summary", "")
        if prefs:
            student_info_parts.append(prefs)

        if student_info_parts:
            context_sections.append(f"## 👤 Student Profile\n" + "\n".join(student_info_parts))

        memory = compiled_context.get("memory", "")
        if memory and memory != "This is the start of a new conversation.":
            context_sections.append(f"## 💬 Conversation History\n{memory}")

        retrieved = compiled_context.get("retrieved", "")
        if retrieved:
            context_sections.append(f"## 📚 Study Materials & Knowledge Base\n{retrieved}")

        db_context = compiled_context.get("database_context", "")
        if db_context:
            context_sections.append(f"## 🗃️ Database Knowledge\n{db_context}")

        live = compiled_context.get("live", "")
        if live:
            context_sections.append(f"## 🌐 Live Data\n{live}")

        # Process attachments
        attachments_context = ""
        image_contents: list[dict] = []
        if ctx.attachments:
            attachments_context = "\n\n## 📎 Uploaded Documents\n"
            for att in ctx.attachments:
                att_type = att.get("type", "unknown")
                att_name = att.get("name", "file")
                att_data = att.get("data", "")

                if att_type == "application/pdf":
                    attachments_context += f"\n### 📄 PDF: {att_name}\n"
                    if att_data.startswith("data:"):
                        att_data = att_data.split(",", 1)[1] if "," in att_data else att_data
                    try:
                        decoded = base64.b64decode(att_data)
                        try:
                            from pypdf import PdfReader
                            from io import BytesIO
                            pdf_file = BytesIO(decoded)
                            reader = PdfReader(pdf_file)
                            extracted_text = ""
                            for page_num, page in enumerate(reader.pages[:30]):
                                text = page.extract_text()
                                if text:
                                    extracted_text += f"\n--- Page {page_num + 1} ---\n{text}"
                            if extracted_text:
                                attachments_context += f"**Content** ({len(reader.pages)} pages):\n{extracted_text[:8000]}\n"
                            else:
                                attachments_context += "**Note**: PDF contains no extractable text (may be scanned/image-based)\n"
                        except Exception as e:
                            attachments_context += f"**Note**: Could not extract text ({str(e)[:100]})\n"
                    except Exception as e:
                        attachments_context += f"**Error**: Failed to decode PDF ({str(e)[:100]})\n"

                elif att_type.startswith("image/"):
                    attachments_context += f"\n### 🖼️ Image: {att_name}\n"
                    attachments_context += "**Image uploaded — analyze it thoroughly, describe what you see, and solve any problems shown.**\n"
                    # Prepare for GPT-4 vision if available
                    if att_data.startswith("data:"):
                        image_contents.append({
                            "type": "image_url",
                            "image_url": {"url": att_data, "detail": "high"},
                        })
                    else:
                        image_contents.append({
                            "type": "image_url",
                            "image_url": {"url": f"data:{att_type};base64,{att_data}", "detail": "high"},
                        })
                else:
                    attachments_context += f"\n### 📎 File: {att_name} ({att_type})\n"

        # Assemble context
        full_context = "\n\n".join(context_sections)
        if attachments_context:
            full_context += attachments_context

        # Build user content (support multimodal if images present)
        user_text = (
            f"{full_context}\n\n"
            f"---\n\n"
            f"## 🎯 Student's Question\n{ctx.query}"
        )

        if image_contents:
            # Use multimodal message format
            user_content: list[dict] = [{"type": "text", "text": user_text}]
            user_content.extend(image_contents)
            return [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ]

        return [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_text},
        ]


tutor_agent = TutorAgent()
