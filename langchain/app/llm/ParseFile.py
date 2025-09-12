from langchain_community.document_loaders import UnstructuredWordDocumentLoader
from langchain_community.document_loaders import TextLoader
from langchain_community.document_loaders import UnstructuredPDFLoader
from langchain_community.document_loaders import UnstructuredMarkdownLoader
from langchain.text_splitter import MarkdownHeaderTextSplitter ## markdown 处理
from langchain.text_splitter import RecursiveCharacterTextSplitter

from concurrent.futures import ThreadPoolExecutor

import magic
import os
from uuid import uuid4


from . import vector_store


def auto_detect_file_type(file_path: str):
    mime = magic.Magic(mime=True)
    mime_type = mime.from_file(file_path)
    if mime_type == 'application/pdf':
        return 'pdf'
    elif mime_type == 'text/plain':
        return 'txt'
    elif mime_type == 'text/markdown':
        return 'md'
    elif mime_type == 'application/msword' or mime_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return 'word'
    else:
        raise ValueError(f"Unsupported file type: {mime_type}")

def _add_single_document(chunk, doc_ids):
    vector_store.add_documents(documents=chunk,ids=doc_ids)

async def parseFile(file_path: str,file_type1: str):
    print(file_path)
    file_type = auto_detect_file_type(file_path)
    print(file_type)
    if file_type.lower() in ['pdf']:
        loader = UnstructuredPDFLoader(file_path, mode="elements")
    elif file_type.lower() in ['txt']:
        loader = TxtLoader(file_path, encoding="utf-8")
    elif file_type.lower() in ['md']:
        loader = UnstructuredMarkdownLoader(file_path, mode="elements")
    elif file_type.lower() in ['word']:
        loader = UnstructuredWordDocumentLoader(file_path, mode="elements")
    else:
        raise ValueError(f"Unsupported file type: {file_type}")
    if file_type.lower() in ['md']:
        text_splitter = MarkdownHeaderTextSplitter(
            chunk_size=1000,
            chunk_overlap=0
        )
    else:
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=0
        )
    file_data = await loader.aload()
    file_chunks = text_splitter.split_documents(file_data)
    print(file_chunks[0])
    dids = [f"{file_path}-{str(uuid4())}" for _ in range(len(file_chunks))]
    loop = asyncio.get_event_loop()
    executor = ThreadPoolExecutor(max_workers=4)
    tasks = [ ]
    for i in range(0, len(file_chunks), 30):
        batch_chunks = file_chunks[i:i+100]
        batch_ids  dids[i:i+100]
        tasks.append(
            loop.run_in_executor(executor, _add_single_document, batch_chunks, batch_ids)
        )
    await asyncio.gather(*tasks)
    print("------ success ------")

