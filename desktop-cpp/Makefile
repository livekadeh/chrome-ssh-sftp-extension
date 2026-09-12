CXX ?= g++
CXXFLAGS ?= -std=c++17 -O3 -Wall -Wextra -Iinclude -Isrc
TARGET = livekadeh-ssh-sftp

UNAME_S := $(shell uname -s)

ifeq ($(UNAME_S),Linux)
    PKG_CONFIG ?= pkg-config
    GTK_FLAGS := $(shell $(PKG_CONFIG) --cflags gtk+-3.0 webkit2gtk-4.1 2>/dev/null || $(PKG_CONFIG) --cflags gtk+-3.0 webkit2gtk-4.0)
    GTK_LIBS := $(shell $(PKG_CONFIG) --libs gtk+-3.0 webkit2gtk-4.1 2>/dev/null || $(PKG_CONFIG) --libs gtk+-3.0 webkit2gtk-4.0)
    CXXFLAGS += $(GTK_FLAGS) -DMG_ENABLE_LINES=1
    LDFLAGS += $(GTK_LIBS) -lssh2 -lpthread
endif

ifeq ($(UNAME_S),Darwin)
    LDFLAGS += -framework WebKit -framework Cocoa -lssh2 -lpthread
endif

SRC = src/main.cpp src/bridge/mongoose.c
LINUX_TARGET = bin/LiveKadeh-SSH-SFTP-Linux-Cpp

all: linux

linux: $(SRC)
	@mkdir -p bin
	$(CXX) $(CXXFLAGS) $(SRC) -o $(LINUX_TARGET) $(LDFLAGS)
	strip $(LINUX_TARGET)
	@echo "✓ Native Linux C++ desktop build successful: $(LINUX_TARGET)"

# MinGW 64-bit cross compilation for Windows
MINGW_CXX = x86_64-w64-mingw32-g++
MINGW_CC = x86_64-w64-mingw32-gcc
WIN_TARGET = bin/LiveKadeh-SSH-SFTP.exe

windows:
	@mkdir -p bin
	x86_64-w64-mingw32-windres -i res/app.rc -o res/app.res.o -O coff --include-dir=res
	$(MINGW_CC) -c src/bridge/mongoose.c -o src/bridge/mongoose.o -Iinclude -O3 -DMG_ENABLE_LINES=1
	$(MINGW_CXX) -std=c++17 -Iinclude -Isrc -c src/main.cpp -o src/main.o -O3
	$(MINGW_CXX) -std=c++17 src/main.o src/bridge/mongoose.o res/app.res.o lib/libssh2.a \
	  -Llib/x64 -lWebView2LoaderStatic \
	  -lole32 -loleaut32 -lshlwapi -lversion -lws2_32 -lbcrypt -lcrypt32 \
	  -static -static-libgcc -static-libstdc++ \
	  -mwindows \
	  -o $(WIN_TARGET)
	x86_64-w64-mingw32-strip $(WIN_TARGET)
	@echo "✓ Windows static build with icon successful: $(WIN_TARGET)"

clean:
	rm -f $(TARGET) src/main.o src/bridge/mongoose.o res/app.res.o $(WIN_TARGET)

.PHONY: all clean windows
