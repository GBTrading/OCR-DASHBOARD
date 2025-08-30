# Environment Setup for Zen MCP Server

This guide will help you securely configure the Gemini API key for the Zen MCP Server integration with Claude Desktop.

## 🔐 Security Setup

### Step 1: Set Environment Variable

**For Windows:**
1. Right-click on `setup_env_windows.bat` and select "Run as administrator"
2. Or manually run the commands in Command Prompt as administrator

**For macOS/Linux:**
1. Make the script executable: `chmod +x setup_env_unix.sh`
2. Run the script: `./setup_env_unix.sh`
3. Restart your terminal

### Step 2: Update Claude Desktop Configuration

1. **Locate your Claude Desktop config file:**
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

2. **Copy the contents** from `claude_desktop_config.json` in this project folder into your Claude Desktop config file

3. **If you already have other MCP servers configured**, just add the "zen" entry to your existing `mcpServers` object

### Step 3: Restart Claude Desktop

After setting the environment variable and updating the config, restart Claude Desktop completely.

## 🔍 Verification

**To verify the environment variable is set:**
- **Windows:** Open Command Prompt and run `echo %GEMINI_API_KEY%`
- **macOS/Linux:** Open Terminal and run `echo $GEMINI_API_KEY`

You should see your API key displayed.

## 🔒 Security Notes

- ✅ The `.env` file is included in `.gitignore` to prevent accidental commits
- ✅ The API key is stored as a system environment variable, not in the Claude config
- ✅ Use `${GEMINI_API_KEY}` syntax in the config to reference the environment variable

## ⚠️ Important

- Never commit API keys to version control
- If you suspect your API key has been compromised, regenerate it in the Google Cloud Console
- Keep your environment files secure and backed up separately from your code

## 🔧 Troubleshooting

### Git Installation Issues (Zen MCP Server)
If you see "Git executable not found" error:
1. **Download Git**: https://git-scm.com/download/win
2. **Install with default settings**
3. **Restart Command Prompt and Claude Desktop**
4. **Run `check_git.bat`** to verify installation

### Alternative: Use NPX Version
If Git installation fails, the config has been updated to try NPX instead:
```json
"zen": {
  "command": "npx",
  "args": ["-y", "zen-mcp-server"],
  "env": { "GEMINI_API_KEY": "${GEMINI_API_KEY}" }
}
```

### General Troubleshooting
If other MCP servers don't work:
1. Verify the environment variable is set correctly
2. Ensure you have `uvx` installed: `pip install uvx`
3. Check that Claude Desktop has been fully restarted
4. Review Claude Desktop logs for any connection errors
