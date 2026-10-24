Fix turn: the two PNG icons from the last turn arrived corrupted. No other changes.

public/favicon-32.png and public/apple-touch-icon.png were sent as binary attachments and were stored as text, so
both files are now larger than the originals and are not valid PNGs. This turn attaches each one as base64 text
instead: public/favicon-32.png.b64 and public/apple-touch-icon.png.b64.

1. Decode each into place, overwriting the corrupted file:
   base64 -d public/favicon-32.png.b64 > public/favicon-32.png
   base64 -d public/apple-touch-icon.png.b64 > public/apple-touch-icon.png
2. Delete the two .b64 files.
3. Run sha256sum on both PNGs. They must be exactly:
   456b93fe7077bc51189a5e01667097ae532c3b49fb9ad1775c41c432b3bfcb9b  public/favicon-32.png
   777cdc1250760fd020c1a5f0d25b204c6de6ca5b2f14bb4e77b759c6199970d2  public/apple-touch-icon.png
4. Run vite build, without deploying anything and without sending any transaction.

Report the two sha256sum lines and the build result. Do not change any other file.
