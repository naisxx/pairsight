# The Splink service for on-prem installs (docs/rules/splink-service.md): the
# pinned Python and requirements, nothing else. The run worker calls it per
# dataset with files in a mounted folder:
#   docker run --rm -v <job folder>:<job folder> pairsight-splink \
#     score --records <job folder>/records.csv --out <job folder>/pairs.csv
FROM python:3.13-slim

WORKDIR /service
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY pairsight_splink ./pairsight_splink

ENTRYPOINT ["python", "-m", "pairsight_splink"]
