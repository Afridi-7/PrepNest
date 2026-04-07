from collections.abc import AsyncGenerator

from app.features.ai_tutor.agents.base import AgentContext, AgentOutput
from app.services.llm_service import llm_service


class TutorAgent:
    name = "tutor_agent"

    async def generate_answer(self, ctx: AgentContext, compiled_context: dict) -> AgentOutput:
        messages = self._build_messages(ctx, compiled_context)
        answer = await llm_service.complete(messages)
        return AgentOutput(name=self.name, content=answer)

    async def stream_answer(self, ctx: AgentContext, compiled_context: dict) -> AsyncGenerator[str, None]:
        messages = self._build_messages(ctx, compiled_context)
        async for token in llm_service.stream_complete(messages):
            yield token

    def _build_messages(self, ctx: AgentContext, compiled_context: dict) -> list[dict]:
        import base64
        
        system_prompt = (
            "# PrepNest AI Tutor - Expert Learning Companion\n\n"
            "You are an exceptional AI tutor specializing in **USAT & HAT exam preparation**. Your role is to deliver **outstanding, engaging, and highly effective** educational content.\n\n"
            "## Core Instructions:\n"
            "1. **Structure & Clarity**: Always organize responses with clear headings, bullet points, and logical flow\n"
            "2. **Depth & Engagement**: Provide thorough explanations that go beyond surface-level understanding\n"
            "3. **Practical Examples**: Include real-world examples, analogies, and case studies\n"
            "4. **Adaptive Teaching**: Adjust complexity based on the learning level mentioned (beginner/intermediate/advanced)\n"
            "5. **Document Analysis**: If user has uploaded documents (PDF/images), analyze them thoroughly and provide detailed insights\n"
            "6. **Interactive Elements**: End responses with practice questions, challenges, or thoughtful discussion points\n"
            "7. **Visual Organization**: Use formatting (##, ###, -, *) effectively for maximum readability\n"
            "8. **Accuracy & Context**: Ground explanations in retrieved knowledge and live data when available\n\n"
            "## Response Format:\n"
            "- Start with a **compelling introduction** that hooks the learner\n"
            "- Use **progressive complexity** - start simple, build up concepts\n"
            "- Include **memorable analogies** and **concrete examples**\n"
            "- End with **actionable next steps** and **practice opportunities**\n"
            "- For math: Always show **step-by-step working** with explanations\n"
            "- For essays: Provide **specific, constructive feedback** with improvements\n\n"
            "## Tone & Style:\n"
            "- Professional yet approachable and encouraging\n"
            "- Enthusiastic about the subject matter\n"
            "- Clear and precise language avoiding jargon\n"
            "- Motivational - help students believe they can succeed\n\n"
            "## Quality Standards:\n"
            "✓ Every explanation is **memorable and insightful**\n"
            "✓ Content is **highly relevant** to USAT & HAT exams\n"
            "✓ Responses are **comprehensive yet concise**\n"
            "✓ Information is **accurate and verifiable**\n"
            "✓ Teaching style is **engaging and effective**"
        )

        attachments_context = ""
        if ctx.attachments:
            attachments_context = "\n\n## 📎 USER UPLOADED DOCUMENTS\n"
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
                            for page_num, page in enumerate(reader.pages):
                                text = page.extract_text()
                                if text:
                                    extracted_text += f"\n--- Page {page_num + 1} ---\n{text}"
                            attachments_context += f"**Content** ({len(reader.pages)} pages):\n{extracted_text}\n"
                        except Exception as e:
                            attachments_context += f"**Note**: Could not extract text from PDF ({str(e)})\n"
                    except Exception as e:
                        attachments_context += f"**Error**: Failed to decode PDF ({str(e)})\n"
                        
                elif att_type.startswith("image/"):
                    attachments_context += f"\n### 🖼️ Image: {att_name}\n"
                    if att_data.startswith("data:"):
                        att_data = att_data.split(",", 1)[1] if "," in att_data else att_data
                    try:
                        decoded = base64.b64decode(att_data)
                        attachments_context += f"**Image uploaded** ({len(decoded)} bytes)\n**Please analyze and explain this image in detail.**\n"
                    except Exception as e:
                        attachments_context += f"**Error**: Failed to decode image ({str(e)})\n"
                else:
                    attachments_context += f"\n### 📎 File: {att_name} ({att_type})\n"
                    
            attachments_context += "\n---\n"

        user_content = (
            f"**Learning Level**: {ctx.learning_level}\n"
            f"**User Preferences**: {compiled_context.get('preferences_summary', 'Standard approach')}\n\n"
            f"**Recent Memory/Context**:\n{compiled_context.get('memory', 'No previous context')}\n\n"
            f"**Retrieved Knowledge**:\n{compiled_context.get('retrieved', 'No specific references found')}\n\n"
            f"**Live Context/Data**:\n{compiled_context.get('live', 'No live updates available')}"
            f"{attachments_context}\n"
            f"## 🎯 User's Question:\n{ctx.query}"
        )

        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]


tutor_agent = TutorAgent()
