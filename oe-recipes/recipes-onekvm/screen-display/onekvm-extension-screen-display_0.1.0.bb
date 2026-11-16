SUMMARY = "OneKVM screen display settings extension"
LICENSE = "GPL-3.0-only"
LIC_FILES_CHKSUM = "file://LICENSE;md5=1ebbd3e34237af26da5dc08a4e440464"
PR = "r0"

ONEKVM_COMPONENT_GIT_URI ??= "git://github.com/onekvm/onekvm-extension-screen-display.git;protocol=https;branch=main"
ONEKVM_COMPONENT_SRCREV ??= ""
SRC_URI = "${ONEKVM_COMPONENT_GIT_URI};destsuffix=${BP}"
SRCREV = "${ONEKVM_COMPONENT_SRCREV}"
inherit onekvm-extension onekvm-web

ONEKVM_EXTENSION_ID = "screen-display"
ONEKVM_EXTENSION_API_VERSION = "2"
ONEKVM_EXTENSION_MANIFEST_TEMPLATE = "${S}/manifest.json.in"
RDEPENDS:${PN} += "onekvm-core onekvm-extension-host"

do_configure[noexec] = "1"
B = "${WORKDIR}/screen-display-build"

do_compile() {
    onekvm_web_build
    install -d ${B}/src ${B}/web/dist
    cp -a ${S}/src/. ${B}/src/
    cp -a ${S}/Makefile ${S}/manifest.json.in ${B}/
    install -m 0644 ${ONEKVM_WEB_BUILD_DIR}/web/dist/display-page.js ${B}/web/dist/display-page.js
    oe_runmake -C ${B} \
        CC="${CC}" \
        CFLAGS="${CFLAGS}" \
        LDFLAGS="${LDFLAGS} -lm"
}

do_install() {
    oe_runmake -C ${B} \
        DESTDIR=${D} \
        PREFIX=${ONEKVM_EXTENSION_ROOT} \
        VERSION=${PV} \
        ARCH=${TARGET_ARCH} \
        install
}
