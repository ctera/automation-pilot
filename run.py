import os
import socket
import sys

import yaml
from dotenv import load_dotenv

load_dotenv()


def main():
    import uvicorn

    config_path = os.environ.get("AUTOPILOT_CONFIG", "backend/config.yaml")
    try:
        with open(config_path) as f:
            cfg = yaml.safe_load(f)
    except FileNotFoundError:
        print(f"Config not found: {config_path}")
        sys.exit(1)

    port = cfg.get("server", {}).get("port", 8080)
    host = cfg.get("server", {}).get("host", "0.0.0.0")

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    if sock.connect_ex(("127.0.0.1", port)) == 0:
        print(f"Port {port} is already in use. Set AUTOPILOT_PORT or change config.yaml.")
        sys.exit(1)
    sock.close()

    uvicorn.run("backend.main:app", host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
