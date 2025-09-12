from fastapi import APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
from app.llm.LLMChain import generate_response
from app.schema.ChatMessage import ChatMessage
from app.schema.ParseFile import FileParseMessage

from app.llm.ParseFile import parseFile



chat_route = APIRouter(
    prefix="",
    tags=["chat"]
)


@chat_route.post("/chat")
async def chatController(message: ChatMessage):
    return StreamingResponse(generate_response(message.message), media_type="text/event-stream")

@chat_route.post("/parse")
async def parseFileController(message: FileParseMessage):
    code = await parseFile(message.file_path,message.file_type)
    return JSONResponse(content={"code": 200, "message": "Success", "data": result})

    
