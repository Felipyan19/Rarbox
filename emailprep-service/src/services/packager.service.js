const plan = (artifactName, deliveryType, usedImages) => {
  const files = [
    { path: `${artifactName}.html`, type: 'html' },
    { path: `${artifactName}.txt`, type: 'txt' },
  ];

  for (const image of usedImages) {
    files.push({
      path: deliveryType === 'standard' ? `images/${image.filename}` : image.filename,
      type: 'image',
    });
  }

  return {
    root_folder: artifactName,
    files,
  };
};

module.exports = {
  plan,
};
