<?php
/*
 * includes/admin_scripts.php
 * Généré le 2026-09-07
 * Balises <script> de fin de page : admin.js, qrcode, ASUP, CT, Cleaning
 */
?>
<script src="admin.js?v=<?= filemtime(__DIR__ . '/../admin.js') ?>"></script>
<script src="qrcode.min.js?v=<?= filemtime(__DIR__ . '/../qrcode.min.js') ?>"></script>
<script type="application/json" id="access-url-data"><?php echo json_encode($url_acces); ?></script>
<script src="admin-qrcode.js?v=<?= filemtime(__DIR__ . '/../admin-qrcode.js') ?>"></script>
<script src="asup-admin.js?v=<?= filemtime(__DIR__ . '/../asup-admin.js') ?>"></script>
<script src="ct-admin.js?v=<?= filemtime(__DIR__ . '/../ct-admin.js') ?>"></script>
<script src="cleaning-admin.js?v=<?= filemtime(__DIR__ . '/../cleaning-admin.js') ?>"></script>
