from app.features.ai_tutor.agents.base import AgentContext, AgentOutput


class MemoryAgent:
    name = "memory_agent"

    async def summarize_context(self, ctx: AgentContext) -> AgentOutput:
        """Build a rich conversational memory from recent messages.

        Extracts: conversation flow, user's recurring topics, learning patterns,
        and preferred interaction style to create a personalised context.
        """
        memory_lines: list[str] = []
        topics_mentioned: list[str] = []
        user_question_count = 0

        for message in ctx.recent_messages[-16:]:
            role = message.get("role", "user")
            content = message.get("content", "")
            truncated = content[:400]
            memory_lines.append(f"{role}: {truncated}")

            if role == "user":
                user_question_count += 1
                # Extract likely topic keywords (simple heuristic)
                words = content.split()
                if len(words) >= 3:
                    # Take longer words as potential topic words
                    topics_mentioned.extend(
                        w.strip(".,!?:;()") for w in words if len(w) > 4
                    )

        # Build user profile summary
        prefs = ctx.user_preferences or {}
        style = prefs.get("style", "balanced")
        pace = prefs.get("pace", "normal")
        subjects = prefs.get("favorite_subjects", [])
        weak_areas = prefs.get("weak_areas", [])

        profile_parts = [
            f"Learning level: {ctx.learning_level}",
            f"Style preference: {style}",
            f"Pace: {pace}",
        ]
        if subjects:
            profile_parts.append(f"Favorite subjects: {', '.join(subjects)}")
        if weak_areas:
            profile_parts.append(f"Areas needing work: {', '.join(weak_areas)}")

        profile_parts.append(f"Questions asked in session: {user_question_count}")

        # Deduplicate topic keywords
        unique_topics = list(dict.fromkeys(topics_mentioned))[:20]
        if unique_topics:
            profile_parts.append(f"Topics discussed: {', '.join(unique_topics[:10])}")

        pref_summary = " | ".join(profile_parts)

        conversation_context = "\n".join(memory_lines) if memory_lines else "This is the start of a new conversation."

        return AgentOutput(
            name=self.name,
            content=conversation_context,
            data={
                "preferences_summary": pref_summary,
                "topics_mentioned": unique_topics,
                "question_count": user_question_count,
            },
        )


memory_agent = MemoryAgent()
