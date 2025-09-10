from langchain_community.document_loaders import UnstructuredWordDocumentLoader
from langchain_community.document_loaders import TextLoader
from langchain_community.document_loaders import UnstructuredPDFLoader
from langchain_community.document_loaders import UnstructuredMarkdownLoader
from langchain.text_splitter import MarkdownHeaderTextSplitter ## markdown 处理
from langchain.text_splitter import RecursiveCharacterTextSplitter

import magic
import os
from uuid import uuid4


from . import vector_store

async def parseFile(file_path: str,file_type: str):
    file_type = await auto_detect_file_type(file_path)
    if file_type.lower() in ['pdf']:
        loader = UnstructuredPDFLoader(file_path, mode="elements")
    elif file_type.lower() in ['txt']:
        loader = TxtLoader(file_path, encoding="utf-8")
    elif file_type.lower() in ['md']:
        loader = UnstructuredMarkdownLoader(file_type, mode="elements")
    elif file_type.lower() in ['word']:
        laoder = UnstructuredWordDocumentLoader(file_path, mode="elements")
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
    dids = [f"{file_path}-{str(uuid4())}" for _ in rnage(len(file_chunks))]
    vector_store.add_documents(documents=file_chunks,ids= dids)



async def auto_detect_file_type(file_path: str):
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
