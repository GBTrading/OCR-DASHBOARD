# Serena MCP Configuration Guide

## Overview
Serena MCP server uses a security-first approach where dangerous tools are disabled by default. This guide shows how to safely enable needed functionality.

## Current Issues Identified
1. **File Creation Error**: `create_text_file` tool disabled by default
2. **Shell Command Error**: Windows-specific subprocess bug (Issues #354, #323, #333)
3. **Workspace Isolation**: Serena operates in sandboxed workspace mode

## Safe Configuration Options

### Option 1: Read-Only Mode (Safest)
```yaml
# .serena/project.yml
read_only: true
excluded_tools:
  - execute_shell_command
  - create_text_file
  - write_memory
```

### Option 2: Controlled Write Access
```yaml
# .serena/project.yml
read_only: false
workspace_dir: "./workspace"
excluded_tools:
  - execute_shell_command  # Keep disabled due to Windows bug
```

### Option 3: Docker Mode (Recommended for Full Access)
```bash
docker run --rm -i --network host \
  -v "$(pwd)":/workspace \
  ghcr.io/oraios/serena:latest \
  serena start-mcp-server --transport stdio
```

## Windows-Specific Workarounds
- Use Git Bash instead of PowerShell/CMD
- Use absolute paths in configuration
- Consider Docker for shell command execution
- Use `shell=True` workaround (requires code modification)

## Project Structure
```
OCR DASHBOARD/
├── .serena/
│   └── project.yml     # Serena configuration
├── workspace/          # Safe file operations directory
├── app.js
├── index.html
└── test files...
```
