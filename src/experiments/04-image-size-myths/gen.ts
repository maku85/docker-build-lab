/**
 * Context generator for experiment 04. Two myths, four Dockerfiles.
 *
 * Cleanup:
 *   inline-clean  RUN dd ...50MB... && rm blob    (one layer, net 0)
 *   late-clean    RUN dd ...50MB... ; RUN rm blob (50MB layer + a whiteout layer)
 *
 * Multi-stage:
 *   single-stage  install build-base in the final image
 *   multi-stage   install build-base in a build stage, COPY only the artifact
 */
import { BASE_IMAGE, BLOB_MB } from "./config.js";
import type { Variant } from "./config.js";

const DOCKERFILES: Record<Variant, string> = {
  "inline-clean": `FROM ${BASE_IMAGE}
RUN dd if=/dev/zero of=/blob bs=1M count=${BLOB_MB} && rm /blob
CMD ["true"]
`,
  "late-clean": `FROM ${BASE_IMAGE}
RUN dd if=/dev/zero of=/blob bs=1M count=${BLOB_MB}
RUN rm /blob
CMD ["true"]
`,
  "single-stage": `FROM ${BASE_IMAGE}
RUN apk add --no-cache build-base
RUN gcc --version | head -1 > /artifact
CMD ["cat", "/artifact"]
`,
  "multi-stage": `FROM ${BASE_IMAGE} AS build
RUN apk add --no-cache build-base
RUN gcc --version | head -1 > /artifact
FROM ${BASE_IMAGE}
COPY --from=build /artifact /artifact
CMD ["cat", "/artifact"]
`,
};

export function contextFiles(variant: Variant): Record<string, string> {
  return { Dockerfile: DOCKERFILES[variant] };
}
