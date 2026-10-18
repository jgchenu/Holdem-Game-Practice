// Host diagnostics only; never linked into the distributed game.
// ABI: Apple OSS xnu/bsd/sys/proc_info_private.h, PROC_PIDCOALITIONINFO (20).
// https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/proc_info_private.h
#include <libproc.h>
#include <stdint.h>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <errno.h>
#include <limits.h>

int main(int argc, char **argv) {
    if (argc < 2 || argc > 4097) return 2;
    for (int i = 1; i < argc; i++) {
        char *end = NULL; long value = strtol(argv[i], &end, 10);
        if (!end || *end || value <= 0 || value > INT_MAX) return 2;
    }
    printf("[");
    for (int i = 1; i < argc; i++) {
        int pid = (int)strtol(argv[i], NULL, 10);
        // Two coalition IDs plus three reserved uint64_t values in this ABI.
        uint64_t info[5] = {0}; errno = 0;
        int size = proc_pidinfo(pid, 20, 0, info, sizeof(info)); int error = errno;
        printf("%s{\"pid\":%d,\"returnedBytes\":%d,\"errno\":%d,\"coalitionIds\":[%" PRIu64 ",%" PRIu64 "]}", i == 1 ? "" : ",", pid, size, error, info[0], info[1]);
    }
    printf("]\n"); return 0;
}
