import * as url from "url";
import path from "path";
import * as fs from "fs";
import LiveSourceLocation from "../model/LiveSourceLocation";
import * as vlq from 'vlq';

export default class SourceMapper {
    scriptLoaded: (sourceLocation: string, scriptId: string) => void;
    mapped: Map<string, MappedFile>

    constructor(scriptLoaded: (sourceLocation: string, scriptId: string) => void) {
        this.scriptLoaded = scriptLoaded;

        this.mapped = new Map<string, MappedFile>();
    }

    map(scriptId: string, fileUrl: string, sourcemapFile?: string) {
        let basePath = process.cwd();
        let filePath = url.parse(fileUrl).path;
        if (!filePath) {
            return; // TODO: Make sure this really only excludes unwanted files, since some scripts in node_modules
            // may be useful to debugging
        }
        let dirPath = path.parse(filePath).dir;

        // No sourcemap was provided, so we assume the file was not transpiled
        if (!sourcemapFile || !fs.existsSync(`${dirPath}/${sourcemapFile}`)) {
            let relative = path.relative(basePath, filePath);
            this.mapped.set(relative, new MappedFile(scriptId));
            this.scriptLoaded(relative, scriptId);
            return;
        }

        fs.readFile(`${dirPath}/${sourcemapFile}`, (err, data) => {
            if (err) {
                console.log(err);
                return;
            }

            let sourcemap = JSON.parse(data.toString());

            parseSourceMap(scriptId, sourcemap, dirPath)
                .forEach((file, source) => {
                    this.mapped.set(source, file);
                    this.scriptLoaded(source, scriptId);
                });
        });
    }

    mapLocation(location: LiveSourceLocation): MappedLocation {
        let mappedFile: MappedFile = this.mapped.get(location.source);

        if (!mappedFile) return undefined;

        return {
            scriptId: mappedFile.scriptId,
            line: mappedFile.mapLine(location.line),
        }
    }
}

export interface MappedLocation {
    scriptId: string;
    line: number;
}

class MappedFile {
    scriptId: string
    mappings: Map<number, number>

    constructor(scriptId: string) {
        this.scriptId = scriptId;
        this.mappings = new Map<number, number>();
    }

    mapLine(line: number): number {
        if (this.mappings.size == 0)
            return line; // Unmapped file

        let mappedLine = this.mappings.get(line);
        if (!mappedLine) {
            // Find the closest line that is mapped
            let closestLine = Array.from(this.mappings.keys())
                .reduce((prev, curr) =>
                    Math.abs(curr - line) < Math.abs(prev - line) ? curr : prev);
            return this.mappings.get(closestLine);
        }
        return mappedLine;
    }
}

function parseSourceMap(scriptId: string, sourcemap: any, dirPath: string): Map<string, MappedFile> {
    // TODO: Somehow handle sources being in a different directory, for example if only the contents of the dist folder is uploaded
    // TODO: Handle running node in a different directory
    let basePath = process.cwd();

    let sources = sourcemap.sources
        .map(source => path.relative(basePath, `${dirPath}/${source}`)); // Find relative paths
    // TODO: Use sourceRoot from the sourcemap (it is blank in most cases, but technically part of the specification)

    // Decode the source map
    let mappings = sourcemap.mappings;
    let lines = mappings.split(";");
    let lineMappings = lines.map(line => line.split(","));
    let decoded = lineMappings.map(line => line.map(vlq.decode));

    let sourceFileIndex = 0;   // second field
    let sourceCodeLine = 0;    // third field

    // Use the decoded data to associate line numbers
    // TODO: Currently we associate every source code line to the first line of the generated code, this is not necessarily the correct line
    let fileCodeLines: number[] = [];
    let mappedFiles: MappedFile[] = [];
    for (let i = 0; i < sources.length; i++) {
        fileCodeLines.push(-1);
        mappedFiles.push(new MappedFile(scriptId));
    }

    for (let i = 0; i < decoded.length; i++) {
        let line = decoded[i];
        for (let entry of line) {
            sourceFileIndex += entry[1];
            sourceCodeLine += entry[2];

            if (sourceCodeLine > fileCodeLines[sourceFileIndex]) {
                fileCodeLines[sourceFileIndex] = sourceCodeLine;

                mappedFiles[sourceFileIndex].mappings.set(sourceCodeLine, i);
            }
        }
    }

    let map = new Map<string, MappedFile>();
    for (let i = 0; i < sources.length; i++) {
        map.set(sources[i], mappedFiles[i]);
    }

    return map;
}