#!/usr/bin/env bash
# Usage: ./scripts/clone-fixture.sh {vscode|django}
case "$1" in
  vscode)
    git clone --depth 1 https://github.com/microsoft/vscode.git fixtures/vscode
    ;;
  django)
    git clone --depth 1 https://github.com/django/django.git fixtures/django
    ;;
  *)
    echo "Usage: ./scripts/clone-fixture.sh {vscode|django}"
    exit 1
    ;;
esac
