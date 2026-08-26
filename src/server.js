const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, (error) => {
  if (error) {
    throw error;
  }
  console.log(`listening on http://localhost:${PORT}`);
});
