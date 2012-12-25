<html>
<head>
    <meta charset="utf8">
    <title>[% title %]</title>
</head>
<body>

    [% INCLUDE 010_sample_sub.tpl %]

    <!-- PARAM -->
    <br />
    say "[% say %]"<br />
    money : [% money | comma %]<br />

    <!-- FUNC -->
    <br />
    [% echo('this is echo') %]<br />
    [% echoAsync('this is echoAsync') %]<br />

    <!-- IF -->
    <br />
    flag is 
    [% IF flag %]
        true
        [% IF flag2 %]
            -> true
        [% ELSE %]
            -> false
        [% /IF %]
    [% ELSE %]
        false
        [% IF flag2 %]
            -> true
        [% ELSE %]
            -> false
        [% /IF %]
    [% /IF %]
    <br />

    <!-- FOR（配列）-->
    <br />
    [% FOR value IN list %]
        - [% loop.count %] : [% value %]<br />
    [% /FOR %]

    <!-- FOR（連想配列）-->
    <br />
    [% FOR data IN info %]
        [% data.key %] : [% data.value %]<br>
    [% /FOR %]

</body>
</html>
