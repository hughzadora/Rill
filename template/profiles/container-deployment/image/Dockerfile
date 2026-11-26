FROM alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf
RUN apk add --no-cache "busybox-extras=1.37.0-r31"
COPY --chown=65534:65534 site/ /srv/
WORKDIR /srv
USER 65534:65534
EXPOSE 8080
HEALTHCHECK --interval=1s --timeout=1s --retries=3 CMD wget -qO- http://127.0.0.1:8080/health
ENTRYPOINT ["httpd", "-f", "-p", "8080", "-h", "/srv"]
