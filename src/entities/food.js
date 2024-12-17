module.exports = (function () {
    /*
    Section: Construction
    */
       function Food (id, position, size, color) {
           this.id = id;
           this.position = position;
           this.size = size;
           this.color = color;
           this.x = position.x;
           this.y = position.y;
           this.rad = size / 2;
           this.eaten = false;
           this.eaten_by = null;
           this.eaten_fr = 0;
           this.sx = 0;
           this.sy = 0;
       }
   
       return Food;
   })();
