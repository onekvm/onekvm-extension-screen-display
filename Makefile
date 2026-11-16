CC ?= gcc
CFLAGS ?= -O2 -Wall -Wextra -std=c11
LDFLAGS ?= -lm
BINARY ?= onekvm-screen-display
PREFIX ?= /usr/local
DESTDIR ?=
VERSION ?= 0.0.0-dev
ARCH ?= unknown

.PHONY: all web install clean

all: $(BINARY)

$(BINARY): src/screen-display.c
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)

web:
	npm run build:web

install: $(BINARY)
	test -f web/dist/display-page.js
	install -Dm0755 $(BINARY) $(DESTDIR)$(PREFIX)/bin/onekvm-screen-display
	install -Dm0644 web/dist/display-page.js $(DESTDIR)$(PREFIX)/web/display-page.js
	install -d $(DESTDIR)$(PREFIX)
	sed -e 's/@ARCH@/$(ARCH)/g' -e 's/@VERSION@/$(VERSION)/g' \
		manifest.json.in >$(DESTDIR)$(PREFIX)/manifest.json
	chmod 0644 $(DESTDIR)$(PREFIX)/manifest.json

clean:
	$(RM) $(BINARY)
	$(RM) -r web/dist
