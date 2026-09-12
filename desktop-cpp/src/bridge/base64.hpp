#ifndef BASE64_HPP
#define BASE64_HPP

#include <string>
#include <vector>

namespace bridge {

inline std::string base64_encode(const unsigned char* data, size_t len) {
    static const char base64_chars[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "abcdefghijklmnopqrstuvwxyz"
        "0123456789+/";

    std::string ret;
    ret.reserve(((len + 2) / 3) * 4);
    int i = 0;
    unsigned char char_array_3[3];
    unsigned char char_array_4[4];

    while (len--) {
        char_array_3[i++] = *(data++);
        if (i == 3) {
            char_array_4[0] = (char_array_3[0] & 0xfc) >> 2;
            char_array_4[1] = ((char_array_3[0] & 0x03) << 4) + ((char_array_3[1] & 0xf0) >> 4);
            char_array_4[2] = ((char_array_3[1] & 0x0f) << 2) + ((char_array_3[2] & 0xc0) >> 6);
            char_array_4[3] = char_array_3[2] & 0x3f;

            for (i = 0; i < 4; i++) {
                ret += base64_chars[char_array_4[i]];
            }
            i = 0;
        }
    }

    if (i) {
        for (int j = i; j < 3; j++) {
            char_array_3[j] = '\0';
        }

        char_array_4[0] = (char_array_3[0] & 0xfc) >> 2;
        char_array_4[1] = ((char_array_3[0] & 0x03) << 4) + ((char_array_3[1] & 0xf0) >> 4);
        char_array_4[2] = ((char_array_3[1] & 0x0f) << 2) + ((char_array_3[2] & 0xc0) >> 6);
        char_array_4[3] = char_array_3[2] & 0x3f;

        for (int j = 0; j < i + 1; j++) {
            ret += base64_chars[char_array_4[j]];
        }

        while (i++ < 3) {
            ret += '=';
        }
    }

    return ret;
}

inline std::string base64_encode(const std::string& in) {
    return base64_encode(reinterpret_cast<const unsigned char*>(in.data()), in.size());
}

inline std::vector<unsigned char> base64_decode(const std::string& in) {
    static const unsigned char d[] = {
        64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
        64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
        64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 62, 64, 64, 64, 63,
        52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 64, 64, 64, 64, 64, 64,
        64,  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14,
        15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 64, 64, 64, 64, 64,
        64, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
        41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 64, 64, 64, 64, 64
    };

    std::vector<unsigned char> out;
    out.reserve(in.size() * 3 / 4);

    int val = 0, valb = -8;
    for (unsigned char c : in) {
        if (c > 127 || d[c] >= 64) continue;
        val = (val << 6) + d[c];
        valb += 6;
        if (valb >= 0) {
            out.push_back(static_cast<unsigned char>((val >> valb) & 0xFF));
            valb -= 8;
        }
    }
    return out;
}

} // namespace bridge

#endif // BASE64_HPP

