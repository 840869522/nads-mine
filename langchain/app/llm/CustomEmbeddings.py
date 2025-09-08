from typing import List, Optional
from langchain_core.embeddings import Embeddings
import requests
import aiohttp
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from requests.exceptions import RequestException
import logging

class CustomEmbeddings(Embeddings):
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        chunk_size: int = 1000,
        max_retries: int = 3,
        timeout: int = 30
    ):
        """
        初始化自定义嵌入类。
        
        参数：
            api_key (str): API 密钥。
            base_url (str): API 基础 URL（如 https://api.x.ai/v1）。
            model (str): 嵌入模型名称（如 gpt-oss-20b）。
            chunk_size (int): 批处理大小，默认为 1000。
            max_retries (int): 最大重试次数，默认为 3。
            timeout (int): 请求超时时间（秒），默认为 30。
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")  # 移除末尾斜杠
        self.model = model
        self.chunk_size = chunk_size
        self.max_retries = max_retries
        self.timeout = timeout
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((RequestException, aiohttp.ClientError))
    )
    def _embed_batch(self, texts: List[str]) -> List[List[float]]:
        """同步发送嵌入请求，包含重试机制"""
        url = f"{self.base_url}/embeddings"
        data = {
            "input": texts,
            "model": self.model
        }
        self.logger.info(f"发送嵌入请求: {url}, 文本数量: {len(texts)}")
        response = requests.post(url, headers=self.headers, json=data, timeout=self.timeout)
        if response.status_code != 200:
            self.logger.error(f"嵌入请求失败: {response.text}")
            raise Exception(f"嵌入请求失败: {response.status_code}, {response.text}")
        try:
            return [item["embedding"] for item in response.json()["data"]]
        except KeyError as e:
            self.logger.error(f"解析响应失败: {response.text}")
            raise Exception(f"解析嵌入响应失败: {str(e)}")

    async def _aembed_batch(self, texts: List[str]) -> List[List[float]]:
        """异步发送嵌入请求，包含重试机制"""
        url = f"{self.base_url}/embeddings"
        data = {
            "input": texts,
            "model": self.model
        }
        self.logger.info(f"发送异步嵌入请求: {url}, 文本数量: {len(texts)}")
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=self.headers, json=data, timeout=self.timeout) as response:
                if response.status != 200:
                    error_text = await response.text()
                    self.logger.error(f"异步嵌入请求失败: {error_text}")
                    raise Exception(f"异步嵌入请求失败: {response.status}, {error_text}")
                try:
                    result = await response.json()
                    return [item["embedding"] for item in result["data"]]
                except KeyError as e:
                    self.logger.error(f"解析异步响应失败: {await response.text()}")
                    raise Exception(f"解析异步嵌入响应失败: {str(e)}")

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        为多个文本生成嵌入。
        
        参数：
            texts (List[str]): 要嵌入的文本列表。
        
        返回：
            List[List[float]]: 嵌入向量列表。
        """
        if not texts:
            return []
        
        # 分批处理
        embeddings = []
        for i in range(0, len(texts), self.chunk_size):
            batch = texts[i:i + self.chunk_size]
            try:
                batch_embeddings = self._embed_batch(batch)
                embeddings.extend(batch_embeddings)
            except Exception as e:
                self.logger.error(f"批处理嵌入失败: {str(e)}")
                raise
        return embeddings

    def embed_query(self, text: str) -> List[float]:
        """
        为单个查询文本生成嵌入。
        
        参数：
            text (str): 要嵌入的查询文本。
        
        返回：
            List[float]: 嵌入向量。
        """
        return self.embed_documents([text])[0]

    async def aembed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        异步为多个文本生成嵌入。
        
        参数：
            texts (List[str]): 要嵌入的文本列表。
        
        返回：
            List[List[float]]: 嵌入向量列表。
        """
        if not texts:
            return []
        
        embeddings = []
        for i in range(0, len(texts), self.chunk_size):
            batch = texts[i:i + self.chunk_size]
            try:
                batch_embeddings = await self._aembed_batch(batch)
                embeddings.extend(batch_embeddings)
            except Exception as e:
                self.logger.error(f"异步批处理嵌入失败: {str(e)}")
                raise
        return embeddings

    async def aembed_query(self, text: str) -> List[float]:
        """
        异步为单个查询文本生成嵌入。
        
        参数：
            text (str): 要嵌入的查询文本。
        
        返回：
            List[float]: 嵌入向量。
        """
        return (await self.aembed_documents([text]))[0]