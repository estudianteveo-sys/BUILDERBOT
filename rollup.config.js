import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default {
    input: 'src/app.ts',
    output: {
        file: 'dist/app.js',
        format: 'esm',
    },
    onwarn: (warning) => {
        if (warning.code === 'UNRESOLVED_IMPORT') return
    },
    plugins: [
        typescript(),
        resolve({ extensions: ['.js', '.ts'] }),
        commonjs(),
    ],
    external: [
        '@builderbot/bot',
        '@builderbot/provider-baileys',
        'openai',
        'dotenv',
        'path',
        'fs',
        'googleapis',
        'date-fns'
    ],
}

