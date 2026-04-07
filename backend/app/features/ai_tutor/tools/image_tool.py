from app.services.llm_service import llm_service


class ImageTool:
    async def generate_study_image(self, prompt: str) -> dict | None:
        if not llm_service.client:
            return None

        try:
            response = await llm_service.client.images.generate(model="gpt-image-1", prompt=prompt, size="1024x1024")
            image_b64 = response.data[0].b64_json if response.data else None
            if not image_b64:
                return None
            return {"type": "image", "base64": image_b64, "prompt": prompt}
        except Exception:
            return None


image_tool = ImageTool()
