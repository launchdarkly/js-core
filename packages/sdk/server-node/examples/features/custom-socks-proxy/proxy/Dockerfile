# A real SOCKS5 server (Dante: https://www.inet.no/dante/) for local development to route
# traffic through.
FROM ubuntu:24.04@sha256:4fbb8e6a8395de5a7550b33509421a2bafbc0aab6c06ba2cef9ebffbc7092d90

COPY setup.sh danted.conf /proxy/

EXPOSE 1080

# setup.sh daemonizes rather than staying in the foreground, so this keeps the container alive
# afterward.
CMD ["/bin/sh", "-c", "/proxy/setup.sh && tail -f /dev/null"]
