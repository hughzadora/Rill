FROM python:3.13-alpine3.24@sha256:9ef1a599f863231c3d91e941389bfdc4a2d6070557243d54df1a4e57015b960e
COPY site/ /srv/
USER 65534:65534
EXPOSE 8080
HEALTHCHECK --interval=1s --timeout=1s --retries=3 CMD wget -qO /dev/null http://127.0.0.1:8080/health
ENTRYPOINT ["python", "-m", "http.server", "8080", "--directory", "/srv"]
