const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');

const app = express();


// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// Create MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'reciplette'
});
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine
app.set('view engine', 'ejs');
// enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));

// Define routes
//app.get routes
app.get('/', (req, res) => {
  const sql = 'SELECT * FROM recipe';
  // Fetch data from MySQL
  connection.query(sql, (error, results) => {
      if (error) {
          console.error('Database query error:', error.message);
          return res.status(500).send('Error retrieving recipes');
      }
      // Render HTML page with data
      res.render('index', { recipe: results });
  });
});

app.get('/category', (req, res) => {
  const sql = 'SELECT * FROM category';
  // Fetch data from MySQL
  connection.query(sql, (error, results) => {
      if (error) {
          console.error('Database query error:', error.message);
          return res.status(500).send('Error retrieving categories');
      }
      // Render HTML page with data
      res.render('category', { category: results });
  });
});

app.get('/recipe/:id', (req, res) => {
  const recipeID = req.params.id;
  const sql = `
    SELECT recipe.*, category.categoryName 
    FROM recipe 
    INNER JOIN category ON recipe.categoryID = category.categoryID 
    WHERE recipe.recipeID = ?`;

  connection.query(sql, [recipeID], (error, results) => {
    if (error) {
      console.error('Error fetching the recipe:', error);
      res.status(500).send('Error fetching the recipe');
    } else {
      if (results.length > 0) {
        res.render('recipe', { recipe: results[0] });
      } else {
        res.status(404).send('Recipe not found');
      }
    }
  });
});

app.get('/addRecipe', (req, res) => {
  const sql = `SELECT * FROM category`;

  connection.query(sql, (error, results) => {
    if (error) {
      console.error('Error fetching categories:', error);
      res.status(500).send('Error fetching categories');
    } else {
      res.render('addRecipe', { categories: results });
    }
  });
});

app.get('/addCategory', (req, res) => {
  res.render('addCategory', { category: {} });
});

app.get('/editRecipe/:id', (req, res) => {
  const recipeID = req.params.id;
  const sql = `
    SELECT recipe.*, category.categoryName 
    FROM recipe 
    INNER JOIN category ON recipe.categoryID = category.categoryID 
    WHERE recipe.recipeID = ?`;
  
  connection.query(sql, [recipeID], (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error retrieving recipe by ID');
    }
    if (results.length > 0) {
      const fetchAllCategoriesSql = 'SELECT * FROM category';
      connection.query(fetchAllCategoriesSql, (error, categories) => {
        if (error) {
          console.error('Database query error:', error.message);
          return res.status(500).send('Error retrieving categories');
        }
        res.render('editRecipe', { recipe: results[0], categories: categories });
      });
    } else {
      res.status(404).send('Recipe not found');
    }
  });
});

app.get('/editCategory/:id', (req, res) => {
  const categoryID = req.params.id;
  const sql = 'SELECT * FROM category WHERE categoryID = ?';

  // Fetch data from MySQL based on the category ID
  connection.query(sql, [categoryID], (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error retrieving category by ID');
    }
    
    if (results.length > 0) {
      res.render('editCategory', { category: results[0] });
    } else {
      res.status(404).send('Category not found');
    }
  });
});

app.get('/roulette', (req, res) => {
  res.render('roulette');
});

app.get('/generateRandomRecipe', (req, res) => {
  //Generates a random recipe ID
  const sql = `
    SELECT recipeID
    FROM roulette
    ORDER BY RAND()
    LIMIT 1;
  `;

  connection.query(sql, (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).send('An error occurred while fetching a random recipe.');
    } else if (results.length === 0) {
      return res.status(404).send('No recipe in roulette.');
    } else {
      const recipeId = results[0].recipeID;
      
      //Redirect first to recipe page
      res.redirect(`/recipe/${recipeId}`);

      // After redirect, will drop the tables
      const dropSql = `TRUNCATE TABLE roulette;`;
      connection.query(dropSql, (dropError) => {
        if (dropError) {
          // Log the error if cannot drop
          console.error(dropError);
        }
      });
    }
  });
});

// POST routes

app.post('/add-to-roulette', (req, res) => {
  const { recipeID } = req.body;

  // Checking if the recipeID is already in another rouletteID
  const checkSql = 'SELECT * FROM Roulette WHERE recipeID = ?';
  connection.query(checkSql, [recipeID], (error, results) => {
    if (error) {
      console.error('Error checking if recipe is already in Roulette:', error.message);
      return res.redirect('/');
    }
    if (results.length > 0) {
      // if recipe already in roulette, will redirect back without any error
      return res.redirect('/');
    }

    // insert into roulette table since recipeID is confirmed to not be inside
    const sql = 'INSERT INTO Roulette (recipeID) VALUES (?)';
    connection.query(sql, [recipeID], (err, result) => {
      res.redirect('/');
    });
  });
});

app.post('/remove-from-roulette', (req, res) => {
  const { recipeID } = req.body;

  const sql = 'DELETE FROM Roulette WHERE recipeID = ?';

  connection.query(sql, [recipeID], (error, results) => {
    if (error) {
      console.error('Error removing recipe from Roulette:', error.message);
      return res.redirect('/');
    }
    res.redirect('/');
  });
});

app.post('/editRecipe/:id', upload.single('image'), (req, res) => {
  const recipeID = req.params.id;
  const { recipe_name, categoryID, difficulty, time, ingredients, recipe } = req.body;
  let image = req.body.currentImage;
  if (req.file) {
      image = req.file.filename;
  }

  const sql = `UPDATE recipe SET recipe_name = ?, categoryID = ?, difficulty = ?, time = ?, ingredients = ?, recipe = ? ${req.file ? ', image = ?' : ''} WHERE recipeID = ?`;
  const params = [recipe_name, categoryID, difficulty, time, ingredients, recipe];
  if (req.file) {
    params.push(image);
  }
  params.push(recipeID);

  connection.query(sql, params, (error) => {
      if (error) {
          console.error('Error updating the recipe:', error);
          res.status(500).send('Error updating the recipe');
      } else {
          res.redirect('/');
      }
  });
});

app.post('/editCategory/:id', (req, res) => {
  const categoryID = req.params.id;
  const { categoryName } = req.body;

  const sql = 'UPDATE category SET categoryName = ? WHERE categoryID = ?';

  connection.query(sql, [categoryName, categoryID], (error) => {
    if (error) {
      console.error('Error updating the category:', error);
      res.status(500).send('Error updating the category');
    } else {
      res.redirect('/category');
    }
  });
});


app.post('/addRecipe', upload.single('image'), (req, res) => {
  const { recipe_name, categoryID, difficulty, time, ingredients, recipe } = req.body;
  let image = '';
  if (req.file) {
    image = req.file.filename;
  }

  const sql = `INSERT INTO recipe (recipe_name, categoryID, difficulty, time, ingredients, recipe, image) VALUES (?, ?, ?, ?, ?, ?, ?)`;

  connection.query(sql, [recipe_name, categoryID, difficulty, time, ingredients, recipe, image], (error, results) => {
    if (error) {
      console.error('Error adding new recipe:', error);
      res.status(500).send('Error adding new recipe');
    } else {
      res.redirect('/');
    }
  });
});

app.post('/deleteRecipe', (req, res) => {
  const { recipeID } = req.body;
  const sql = 'DELETE FROM recipe WHERE recipeID = ?';

  connection.query(sql, [recipeID], (error, results) => {
    if (error) {
      console.error('Error deleting the recipe:', error);
      return res.status(500).send('Error deleting the recipe');
    }
    res.redirect('/');
  });
});

app.post('/deleteCategory', (req, res) => {
  const { categoryID } = req.body;
  const sql = 'DELETE FROM category WHERE categoryID = ?';

  connection.query(sql, [categoryID], (error, results) => {
    if (error) {
      console.error('Error deleting the category:', error);
      return res.status(500).send('Error deleting the category');
    }
    res.redirect('/category');
  });
});

app.post('/addCategory', (req, res) => {
  const { categoryName } = req.body;
  const sql = 'INSERT INTO category (categoryName) VALUES (?)';

  connection.query(sql, [categoryName], (error, results) => {
    if (error) {
      console.error('Error adding new category:', error);
      return res.status(500).send('Error adding new category');
    }
    res.redirect('/category');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));