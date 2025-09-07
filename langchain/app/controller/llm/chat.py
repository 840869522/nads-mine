from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.llm.LLMChain import generate_response
from app.schema.ChatMessage import ChatMessage


chat_route = APIRouter(
    prefix="",
    tags=["chat"]
)


@chat_route.post("/chat")
async def chat(message: ChatMessage):
    return StreamingResponse(generate_response(message.message), media_type="text/event-stream")
