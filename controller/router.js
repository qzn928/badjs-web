/**
 * @info : 页面申请路由
 * @author : coverguo
 * @date : 2014-12-16
 */

var logAction = require('./action/logAction'),
    applyAction = require('./action/applyAction'),
    userAction = require("./action/userAction"),
    approveAction = require("./action/approveAction"),
    auth = require('../utils/auth'),
    tof = require('../oa/node-tof');

var log4js = require('log4js'),
    logger = log4js.getLogger();

module.exports = function(app){
    var isError = function (res , error){
        if(error){
            res.json({ret : 1 , msg : error});
            return true;
        }
        return false;

    };
    app.use(function (req , res , next){
        var params = req.query,
            user  = req.session.user = {loginName: "coverguo", chineseName: '郭锋棉' ,role : 1},
            //获取用户model
            userDao = req.models.userDao;

        req.indexUrl = req.protocol + "://" + req.get('host') + '/index.html';

        if(/^\/login/i.test(req.url)){ // 登录
            var redirectUrl = req.headers.referer || req.indexUrl;
            res.redirect('http://passport.oa.com/modules/passport/signin.ashx?url='+redirectUrl);
            return ;
        }
        if ( params && params.ticket) { // oa 登录跳转
            tof.passport(params.ticket , function (result){
                if(result){
                    req.session.user = {loginName : result.LoginName , chineseName : result.ChineseName, role : 0};
                    userDao.one({ loginName : result.LoginName} ,function (err , user) {
                        if(isError(res,err)){
                            return;
                        }
                        //第一次登陆
                        if(!user){

                            userDao.create(req.session.user, function(err, result){
                                if(isError(res, err)){
                                    return;
                                }
                                logger.info("New User:"+ req.session.user + "insert into db-badjs");
                            });
                        }else{
                           logger.info("Old User:"+ req.session.user);
                           req.session.user.role = user.role;
                        }
                        next();
                    })

                }else {
                    res.send(403, 'Sorry! you can not see that.');
                }
            });
        } else  if(req.session.user){ // 已经登录
            next();
            return;
        }else {
            res.redirect(req.protocol + "://" + req.get('host') + '/login');
        }

        /*  游客 访问 */
        if(!/^\/manage\/.*/i.test(req.url)){

            next();
            return ;
        }
        //管理员访问
        if(user){
            console.log("manage");
            userDao.one({ loginName : user.loginName} , function (error , result){
                if(isError(res,error)){
                    return;
                }

                // not admin ,  response error
                if(/^\/manage\/admin\/.*/i.test(req.url) && result.role !== 1){
                    res.json({ec : 1 , em : 'Sorry! you can not invoke. '});
                    return ;
                }

                next();
                return;
            });
        }else if(!req.session.user){ // 跳转OA 登录
            res.redirect('http://passport.oa.com/modules/passport/signin.ashx?url='+req.actrulUrl);
        }
    });



     app.get('/index.html', function(req, res){
         var params = req.query,
             user  = req.session.user;

         res.render('log', { layout: false, user: user, index:"log" });

     });
    app.get('/apply.html', function(req, res){
        var params = req.query,
            user  = req.session.user;
        res.render('apply', { layout: false, user: user, index:'apply' });

    });
    app.get('/applyList.html', function(req, res){
        var params = req.query,
            user  = req.session.user;
        res.render('applyList', { layout: false, user: user, index:'applyList' });

    });
    app.get('/userManage.html', function(req, res){
        var params = req.query,
            user  = req.session.user;
        res.render('userManage', { layout: false, user: user, index:'userManage' });

    });


    app.get('/', function(req, res){

        var params = req.query,
            user  = req.session.user;

        res.render('log', { layout: false, user: user, index:'log' });


    });
    /**
     * 登出
     * */
    app.get('/logout', function(req, res){

        var signoutUrl = 'http://passport.oa.com/modules/passport/signout.ashx?url={yourWebsite}';
        req.session.user = null;
        var homeUrl = req.protocol + "://" + req.get('host')+'/';
        signoutUrl = signoutUrl.replace('{yourWebsite}', encodeURIComponent(homeUrl));
        res.redirect(signoutUrl);
    });

    /**
     * 查看log列表
     * */
    app.get('/controller/action/queryLogList.do', function(req, res){

        paramsStr = decodeURI(req.url.split('?')[1]);

        logger.debug('query param :' + paramsStr);
        logAction.getLogList(req.query,function(err,data){
            if(isError(res, err)){
                return;
            }
            res.json({ret:0, data: data});
        });

    });
    /**
     * 获取用户表
     * */

    app.get('/controller/action/queryUserList.do', function(req, res){
        var params = req.query;
        params.user = req.session.user;
        if(req.session.user.role !=1){
            res.json({ret:1003, msg:"权限不足"});
        }
        userAction.queryList(params,function(err,data){
            if(isError(res, err)){
                return;
            }
            res.json(data);
        });

    });
    /**
     * 获取申请表
     * */

    app.get('/controller/action/queryApplyList.do', function(req, res){

        var params = req.query;
        params.user = req.session.user;

        applyAction.queryList(params,function(err,data){
            if(isError(res, err)){
                return;
            }
            res.json(data);
        });

    });
    /**
     * 增添申请表
     * */

    app.post('/controller/action/addApply.do', function(req, res){
        var apply = req.body;
        apply.userName = req.session.user.loginName;
        apply.createTime = new Date();
        apply.status = 0;
        logger.debug('add_apply param :' + apply);
        applyAction.addApply(apply,function(err,data){
            if(isError(res, err)){
                return;
            }
            res.json({ret:0, msg:"success add"});
        });

    });
    /**
     * 审核申请表
     * */
    app.post('/controller/action/approve.do', function(req, res){
        var approve = req.body;
        approve.createTime = new Date();
        approve.userName = req.session.user.loginName;
        logger.debug('add_approve param :' + approve);
        approveAction.addApprove(approve,function(err,data){
            if(isError(res, err)){
                return;
            }
            res.json({ret:0, msg:"success add"});
        });


    });








 };