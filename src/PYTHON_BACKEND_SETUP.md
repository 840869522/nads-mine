# Python Backend Setup for VM Management API

This document outlines the steps to set up the Python environment required for the FastAPI backend that provides the VM management API. The Node.js server (`src/server.js`) is responsible for launching this Python backend automatically.

## Prerequisites

1.  **Python 3.8+**: Ensure you have Python 3.8 or a newer version installed on your system. You can download it from [python.org](https://www.python.org/downloads/).
    Verify your installation:
    ```bash
    python --version
    # or
    python3 --version
    ```

2.  **pip**: Python's package installer, `pip`, is usually included with Python installations. If not, follow the official installation guide: [pip installation](https://pip.pypa.io/en/stable/installation/).

## Setup Instructions

1.  **Navigate to the Project's `src` Directory**:
    Open your terminal and change to the `src` directory of this project, where the Python backend files (`main.py`, `requirements.txt`) are located.
    ```bash
    cd path/to/your/project/src
    # Or if you are in the project root:
    # cd src
    ```

2.  **Create a Virtual Environment (Recommended)**:
    It's highly recommended to use a virtual environment to manage project-specific dependencies. This isolates your project's Python packages from the global Python installation.

    *   Create the virtual environment (e.g., named `.venv`):
        ```bash
        python3 -m venv .venv
        ```
        (If `python3` doesn't work, try `python`)

    *   Activate the virtual environment:
        *   On macOS and Linux:
            ```bash
            source .venv/bin/activate
            ```
        *   On Windows (Git Bash or similar):
            ```bash
            source .venv/Scripts/activate
            ```
        *   On Windows (Command Prompt):
            ```bash
            .venv\Scripts\activate.bat
            ```
        Your terminal prompt should now indicate that the virtual environment is active (e.g., `(.venv) your-prompt$`).

3.  **Install Dependencies**:
    With the virtual environment activated, install the required Python packages listed in `requirements.txt` (which is now located in the `src` directory).
    ```bash
    pip install -r requirements.txt
    ```
    This will install `fastapi`, `uvicorn`, `pydantic`, `python-dotenv`, and any other necessary libraries.
    *Note: `libvirt-python` is commented out in `requirements.txt` as it's for the actual libvirt integration, which is currently mocked. If you intend to connect to a real libvirt daemon, you'll need to uncomment it and ensure libvirt development headers are available on your system.*

4.  **Ensure `http-proxy-middleware` is installed for Node.js server**:
    The main Node.js server (`src/server.js`) uses `http-proxy-middleware` to proxy API requests to the Python backend. This Node.js dependency should be listed in `src/package.json`. If it's missing, navigate to the `src` directory (if your `package.json` is there) or the project root (if `package.json` is there) and run:
    ```bash
    npm install http-proxy-middleware
    # or
    yarn add http-proxy-middleware
    ```
    *(This step is for the Node.js environment, not Python, but crucial for the proxying to work.)*


## Running the Backend

You do **not** need to run `uvicorn src.main:app` manually.
The Python FastAPI backend is automatically started as a child process by the main Node.js server (`src/server.js`) when you run the frontend/Node.js application (e.g., using `npm start` or `yarn start` from the directory containing the main `package.json`, likely the project root or `src/`).

The Node.js server will:
*   Launch the Uvicorn server for `src/main.py` on port 8000 (or as configured by `PYTHON_API_PORT` environment variable).
*   Proxy requests made to `/api/vm/*` (on the Node.js server's port, e.g., 3000) to the Python backend on port 8000.

Check the console output when starting `src/server.js` for messages indicating the FastAPI server's status.

## Troubleshooting

*   **Command `uvicorn` not found (when `server.js` tries to run it)**:
    *   Ensure the virtual environment (`.venv`) was created inside the `src` directory and that `uvicorn` was installed correctly into it via `pip install -r requirements.txt`.
    *   The `server.js` script attempts to run `uvicorn` directly. If your system PATH or virtual environment setup doesn't allow `server.js` (a Node process) to find `uvicorn` from the activated Python venv that `server.js` itself is *not* running in, you might need to adjust the `childProcessSpawn` command in `server.js` to use the absolute path to the `uvicorn` executable within `.venv/bin/uvicorn` or ensure the environment `server.js` runs in has the `.venv/bin` in its PATH.
    *   A simpler approach for development might be to ensure the virtual environment is activated in the terminal *before* you run `npm start` for `server.js`. This often makes `uvicorn` available in the PATH for child processes.

*   **Proxy Errors**:
    *   Check that the FastAPI server (Python) started correctly by looking at the console output from `server.js`.
    *   Ensure the `FASTAPI_TARGET_URL` in `server.js` (e.g., `http://127.0.0.1:8000`) matches where the Python Uvicorn server is actually listening.

*   **Port Conflicts**:
    *   If port 8000 (for Python) or 3000 (for Node.js) is in use, you can change them.
        *   For Python/FastAPI: Set the `PYTHON_API_PORT` environment variable before running `server.js`.
        *   For Node.js/Next.js: Set the `PORT` environment variable.

By following these steps, the Python backend should be correctly configured and launched by the main application server.
