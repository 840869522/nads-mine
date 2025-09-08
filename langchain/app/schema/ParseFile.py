from pydantic import BaseModel

class FileParseMessage(BaseModel):
    file_path : str
    file_type: str
    

