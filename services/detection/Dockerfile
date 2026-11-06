FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HOME=/models
WORKDIR /app
RUN useradd --create-home --uid 10001 app && mkdir /data /models && chown app:app /data /models
COPY requirements.txt requirements-ml.txt ./
ARG INSTALL_ML=false
RUN pip install --no-cache-dir -r requirements.txt && if [ "$INSTALL_ML" = true ]; then pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && pip install --no-cache-dir -r requirements-ml.txt; fi
COPY skullbot_detection ./skullbot_detection
COPY scripts ./scripts
USER app
EXPOSE 8089
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8089/health')"
CMD ["uvicorn", "skullbot_detection.api:app", "--host", "0.0.0.0", "--port", "8089", "--workers", "1", "--limit-concurrency", "64", "--timeout-keep-alive", "10"]
