const ngrok = require('@ngrok/ngrok');

async function startNgrok() {
    try {
        console.log('🚀 Starting ngrok tunnel for VS Code Live Server...');
        
        // Create a tunnel to port 5500 (VS Code Live Server default)
        const tunnel = await ngrok.forward({ 
            addr: 5500, 
            authtoken_from_env: true 
        });
        
        console.log('✅ Ngrok tunnel started successfully!');
        console.log('');
        console.log('🌐 Public URL:', tunnel.url());
        console.log('🏠 Local URL: http://localhost:5500');
        console.log('');
        console.log('📱 Use the Public URL on your phone to access the site');
        console.log('');
        console.log('Press Ctrl+C to stop the tunnel');
        
        // Keep the process running
        process.on('SIGINT', async () => {
            console.log('\n🛑 Closing ngrok tunnel...');
            await ngrok.kill();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Failed to start ngrok:', error.message);
        
        if (error.message.includes('authtoken')) {
            console.log('');
            console.log('🔑 You need to sign up for a free ngrok account:');
            console.log('   1. Go to: https://ngrok.com/signup');
            console.log('   2. Get your authtoken');
            console.log('   3. Run: npx ngrok config add-authtoken YOUR_TOKEN');
            console.log('   4. Then run this script again');
        }
    }
}

startNgrok();