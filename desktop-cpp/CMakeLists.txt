cmake_minimum_required(VERSION 3.16)

project(LiveKadehDesktopNative
    VERSION 1.5.1
    DESCRIPTION "High-performance native C++ desktop client with embedded bridge for LiveKadeh SSH & SFTP Pro"
    LANGUAGES CXX C
)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include_directories(
    include
    src
)

# Source files
set(SOURCES
    src/main.cpp
    src/bridge/mongoose.c
)

set(HEADERS
    src/webview.h
    src/bridge_manager.hpp
    src/polyfills.hpp
    src/bridge/base64.hpp
    src/bridge/cpp_bridge_session.hpp
    src/bridge/cpp_bridge_server.hpp
    include/mongoose.h
    include/libssh2.h
    include/libssh2_sftp.h
)

# Target executable definition
if(WIN32)
    set(WIN_RESOURCES res/app.rc)
    add_executable(LiveKadeh-SSH-SFTP WIN32 ${SOURCES} ${HEADERS} ${WIN_RESOURCES})
else()
    add_executable(livekadeh-ssh-sftp ${SOURCES} ${HEADERS})
endif()

# Platform-specific dependencies and linker flags
if(APPLE)
    target_link_libraries(livekadeh-ssh-sftp PRIVATE
        "-framework WebKit"
        "-framework Cocoa"
        pthread
    )
    set_target_properties(livekadeh-ssh-sftp PROPERTIES
        MACOSX_BUNDLE TRUE
        OUTPUT_NAME "LiveKadeh-SSH-SFTP"
    )

elseif(WIN32)
    # Windows Microsoft Edge WebView2 and Embedded Bridge configuration
    target_include_directories(LiveKadeh-SSH-SFTP PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/include
    )

    if(CMAKE_SIZEOF_VOID_P EQUAL 8)
        set(WV2_ARCH "x64")
    else()
        set(WV2_ARCH "x86")
    endif()

    target_link_directories(LiveKadeh-SSH-SFTP PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/lib
        ${CMAKE_CURRENT_SOURCE_DIR}/lib/${WV2_ARCH}
    )

    target_link_libraries(LiveKadeh-SSH-SFTP PRIVATE
        WebView2LoaderStatic
        ${CMAKE_CURRENT_SOURCE_DIR}/lib/libssh2.a
        version
        shcore
        shlwapi
        dwmapi
        user32
        ole32
        oleaut32
        shell32
        advapi32
        ws2_32
        bcrypt
        crypt32
    )

    # Copy assets and WebView2Loader.dll
    add_custom_command(TARGET LiveKadeh-SSH-SFTP POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/lib/${WV2_ARCH}/WebView2Loader.dll"
        $<TARGET_FILE_DIR:LiveKadeh-SSH-SFTP>
        COMMENT "Copying WebView2Loader.dll to build output directory"
    )

else()
    # Linux GTK3 & WebKit2GTK configuration
    find_package(PkgConfig REQUIRED)

    pkg_check_modules(WEBKIT webkit2gtk-4.1)
    if(NOT WEBKIT_FOUND)
        pkg_check_modules(WEBKIT REQUIRED webkit2gtk-4.0)
    endif()

    pkg_check_modules(GTK REQUIRED gtk+-3.0)

    target_include_directories(livekadeh-ssh-sftp PRIVATE
        ${GTK_INCLUDE_DIRS}
        ${WEBKIT_INCLUDE_DIRS}
    )

    target_link_libraries(livekadeh-ssh-sftp PRIVATE
        ${GTK_LIBRARIES}
        ${WEBKIT_LIBRARIES}
        ssh2
        pthread
    )

    target_compile_options(livekadeh-ssh-sftp PRIVATE
        ${GTK_CFLAGS_OTHER}
        ${WEBKIT_CFLAGS_OTHER}
    )
endif()

# Compiler optimizations and static runtime for MinGW
if(MSVC)
    target_compile_options(LiveKadeh-SSH-SFTP PRIVATE /O2 /W4 /EHsc /utf-8)
elseif(MINGW)
    target_compile_options(LiveKadeh-SSH-SFTP PRIVATE -O3 -Wall -Wextra)
    target_link_options(LiveKadeh-SSH-SFTP PRIVATE -static -static-libgcc -static-libstdc++)
else()
    target_compile_options(${PROJECT_NAME} PRIVATE -O3 -Wall -Wextra)
endif()
