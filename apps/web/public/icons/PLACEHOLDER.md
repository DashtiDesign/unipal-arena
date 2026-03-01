# Icon placeholders

Add the following PNG files here before publishing:

| File           | Size      | Usage                          |
|----------------|-----------|--------------------------------|
| icon-192.png   | 192×192   | Android homescreen / manifest  |
| icon-512.png   | 512×512   | Splash screen / manifest       |
| apple-touch-icon.png | 180×180 | iOS Add to Home Screen    |

Generate them from your logo SVG with:

```
npx sharp-cli --input logo.svg --output icon-192.png --width 192 --height 192
npx sharp-cli --input logo.svg --output icon-512.png --width 512 --height 512
npx sharp-cli --input logo.svg --output apple-touch-icon.png --width 180 --height 180
```
