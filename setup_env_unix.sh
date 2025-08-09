#!/bin/bash

echo "Setting up Gemini API Key environment variable..."

# Add to current session
export GEMINI_API_KEY="AIzaSyDwwiv_ZGUlMqLmz9N_90V-SBbUoVeRRPw"

# Add to bash profile for persistence
if [ -f ~/.bash_profile ]; then
    echo 'export GEMINI_API_KEY="AIzaSyDwwiv_ZGUlMqLmz9N_90V-SBbUoVeRRPw"' >> ~/.bash_profile
    echo "Added to ~/.bash_profile"
elif [ -f ~/.bashrc ]; then
    echo 'export GEMINI_API_KEY="AIzaSyDwwiv_ZGUlMqLmz9N_90V-SBbUoVeRRPw"' >> ~/.bashrc
    echo "Added to ~/.bashrc"
fi

# Add to zsh profile if it exists (common on macOS)
if [ -f ~/.zshrc ]; then
    echo 'export GEMINI_API_KEY="AIzaSyDwwiv_ZGUlMqLmz9N_90V-SBbUoVeRRPw"' >> ~/.zshrc
    echo "Added to ~/.zshrc"
fi

echo ""
echo "Environment variable GEMINI_API_KEY has been set."
echo "Please restart your terminal and Claude Desktop for changes to take effect."
echo ""
echo "To verify the variable was set, run: echo \$GEMINI_API_KEY"
echo ""
