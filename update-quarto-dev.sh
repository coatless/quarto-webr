QUARTO_VERSION="1.4.349"

wget -O quarto-latest.deb https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-amd64.deb

sudo dpkg -i ./quarto-latest.deb

rm quarto-latest.deb
