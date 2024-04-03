app.get('/welcome', (req, res) => {
    res.json({status: 'success', message: 'Welcome!'});
});
// This needs to replace app.listen(3000);
module.exports = app.listen(3000);