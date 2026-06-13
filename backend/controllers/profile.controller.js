const axios = require("axios");

exports.getProfile = async (req,res)=>{

 try{

   const token =
   req.headers.authorization?.split(" ")[1];

   const response =
   await axios.get(
     "https://render-proxy-mhit.onrender.com/api/StudentPortalAPI/studentpersinfo/getstudent-personalinformation",
     {
       headers:{
         Authorization:`Bearer ${token}`
       }
     }
   );

   res.json(response.data);

 }catch(err){

   res.status(500).json({
     message:"Failed"
   });
 }
};