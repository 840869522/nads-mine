import re
from typing import List, AsyncGenerator, Any
from langchain_core.runnables import Runnable
from langchain_core.messages import AIMessage, AIMessageChunk
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StreamOutputHandler(Runnable):
    def __init__(self, chunk_threshold: int = 3):
        self.chunk_threshold = chunk_threshold
        self.buffer: List[str] = []

    def invoke(self, input: Any, config: dict = None) -> AIMessage:
        logger.warning("invoke 方法不适用于流式输出，使用 astream 替代")
        return AIMessage(content="")

    async def astream(self, input: Any, config: dict = None) -> AsyncGenerator[str, None]:
        try:
            if input is None:
                logger.warning("收到 None 输入，返回空字符串")
                yield "**警告**：模型未返回有效输出，请检查模型连接或配置。"
                return

            if isinstance(input, str):
                clear_input = input.strip()
                if clear_input:
                    self.buffer.append(input)
                    if len(self.buffer) >= self.chunk_threshold:
                        yield await self.flush_buffer()
            elif isinstance(input, (AIMessageChunk, AIMessage)) and chunk_content.strip():
                chunk_content = input.content
                if chunk_content is not None:
                    self.buffer.append(str(chunk_content))
                    if len(self.buffer) >= self.chunk_threshold:
                        yield await self.flush_buffer()
                else:
                    logger.warning("收到空的 AIMessage 或 AIMessageChunk 内容")
                    yield "**警告**：模型返回空内容，可能存在连接问题。"
            else:
                logger.warning(f"意外的输入类型: {type(input)}")
                yield f"**错误**：收到意外的输入类型 {type(input)}，请检查模型输出。"
        except ConnectionRefusedError as e:
            logger.error(f"连接被拒绝: {e}")
            yield "**错误**：无法连接到模型服务器，请检查服务器是否运行以及主机/端口是否正确。"
        except TimeoutError as e:
            logger.error(f"连接超时: {e}")
            yield "**错误**：模型服务器响应超时，请检查网络连接。"
        except Exception as e:
            logger.error(f"处理块时出错: {e}")
            yield f"**错误**：发生意外错误：{str(e)}"

    async def flush_buffer(self) -> str:
        if not self.buffer:
            logger.debug("缓冲区为空，跳过刷新")
            return ""
        combined_content = "".join(self.buffer)
        fixed_content = self.fix_markdown(combined_content)
        self.buffer.clear()
        return fixed_content

    def fix_markdown(self, content: str) -> str:
        content = self.ensure_code_block_completion(content)
        content = self.ensure_list_completion(content)
        content = self.ensure_heading_completion(content)
        return content

    def ensure_code_block_completion(self, content: str) -> str:
        code_block_pattern = r"```[\w]*\n"
        open_code_blocks = len(re.findall(code_block_pattern, content))
        close_code_blocks = content.count("```")
        if open_code_blocks > close_code_blocks:
            content += "\n```"
        return content

    def ensure_list_completion(self, content: str) -> str:
        list_pattern = r"^\s*[-*+]\s+[^\n]*$"
        lines = content.split("\n")
        fixed_lines = []
        for i, line in enumerate(lines):
            if re.match(list_pattern, line) and i < len(lines) - 1:
                fixed_lines.append(line)
                if not re.match(list_pattern, lines[i + 1]) and lines[i + 1].strip():
                    fixed_lines.append("")
            else:
                fixed_lines.append(line)
        return "\n".join(fixed_lines)

    def ensure_heading_completion(self, content: str) -> str:
        heading_pattern = r"^#{1,6}\s+[^\n]*$"
        lines = content.split("\n")
        fixed_lines = []
        for line in lines:
            if re.match(r"^#{1,6}\s*$", line):
                fixed_lines.append(line + " 未完成标题")
            else:
                fixed_lines.append(line)
        return "\n".join(fixed_lines)

    async def finalize(self):
        if self.buffer:
            logger.info("Finalizing stream, flushing buffer")
            yield await self.flush_buffer()
        else:
            logger.debug("Finalize called, but buffer is empty")